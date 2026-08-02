/**
 * A tiny, safe expression compiler for state-level formulas (no `eval`/`Function`).
 *
 * Formulas are strings beginning with `=`, e.g.:
 *   "=max"                          (a sibling field on the current component)
 *   "=Transform.position.y <= 0.55" (a field on another component, vector access)
 *   "=clamp(Health.current, 0, max)"
 *   "=other('entity:zone/a').occupied"
 *
 * Compilation is pure and deterministic so every client derives identical values
 * from identical inputs — the basis for low-bandwidth multiplayer (M3+).
 */
import type { CompiledFormula, FormulaScope } from '$lib/engine/ontology/schema';

type Node =
	| { k: 'lit'; v: unknown }
	| { k: 'id'; name: string }
	| { k: 'member'; obj: Node; prop: string }
	| { k: 'call'; callee: Node; args: Node[] }
	| { k: 'unary'; op: string; arg: Node }
	| { k: 'binary'; op: string; left: Node; right: Node }
	| { k: 'cond'; test: Node; then: Node; else: Node };

const BINARY_PREC: Record<string, number> = {
	'||': 1,
	'&&': 2,
	'==': 3,
	'!=': 3,
	'<': 4,
	'<=': 4,
	'>': 4,
	'>=': 4,
	'+': 5,
	'-': 5,
	'*': 6,
	'/': 6,
	'%': 6
};

const VEC_INDEX: Record<string, number> = { x: 0, y: 1, z: 2, w: 3 };

// ---- tokenizer -------------------------------------------------------------

type Token = { t: 'num' | 'str' | 'id' | 'op'; v: string };

function tokenize(src: string): Token[] {
	const tokens: Token[] = [];
	let i = 0;
	const ops = ['<=', '>=', '==', '!=', '&&', '||'];
	while (i < src.length) {
		const c = src[i];
		if (c === ' ' || c === '\t' || c === '\n') {
			i++;
			continue;
		}
		if (c >= '0' && c <= '9') {
			let j = i + 1;
			while (j < src.length && /[0-9.]/.test(src[j])) j++;
			tokens.push({ t: 'num', v: src.slice(i, j) });
			i = j;
			continue;
		}
		if (c === "'" || c === '"') {
			let j = i + 1;
			while (j < src.length && src[j] !== c) j++;
			tokens.push({ t: 'str', v: src.slice(i + 1, j) });
			i = j + 1;
			continue;
		}
		if (/[A-Za-z_]/.test(c)) {
			let j = i + 1;
			while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++;
			tokens.push({ t: 'id', v: src.slice(i, j) });
			i = j;
			continue;
		}
		const two = src.slice(i, i + 2);
		if (ops.includes(two)) {
			tokens.push({ t: 'op', v: two });
			i += 2;
			continue;
		}
		tokens.push({ t: 'op', v: c });
		i++;
	}
	return tokens;
}

// ---- parser (precedence climbing) -----------------------------------------

class Parser {
	private pos = 0;
	constructor(private tokens: Token[]) {}

	private peek(): Token | undefined {
		return this.tokens[this.pos];
	}
	private next(): Token | undefined {
		return this.tokens[this.pos++];
	}
	private eat(v: string) {
		const t = this.next();
		if (!t || t.v !== v) throw new Error(`Expected "${v}"`);
	}

	parse(): Node {
		const node = this.ternary();
		if (this.peek()) throw new Error(`Unexpected token "${this.peek()!.v}"`);
		return node;
	}

	private ternary(): Node {
		const test = this.binary(0);
		if (this.peek()?.v === '?') {
			this.next();
			const then = this.ternary();
			this.eat(':');
			const els = this.ternary();
			return { k: 'cond', test, then, else: els };
		}
		return test;
	}

	private binary(minPrec: number): Node {
		let left = this.unary();
		while (true) {
			const op = this.peek();
			if (!op || op.t !== 'op' || !(op.v in BINARY_PREC)) break;
			const prec = BINARY_PREC[op.v];
			if (prec < minPrec) break;
			this.next();
			const right = this.binary(prec + 1);
			left = { k: 'binary', op: op.v, left, right };
		}
		return left;
	}

	private unary(): Node {
		const t = this.peek();
		if (t && (t.v === '-' || t.v === '!')) {
			this.next();
			return { k: 'unary', op: t.v, arg: this.unary() };
		}
		return this.postfix();
	}

	private postfix(): Node {
		let node = this.primary();
		while (true) {
			const t = this.peek();
			if (t?.v === '.') {
				this.next();
				const name = this.next();
				if (!name || name.t !== 'id') throw new Error('Expected property name');
				node = { k: 'member', obj: node, prop: name.v };
			} else if (t?.v === '(') {
				this.next();
				const args: Node[] = [];
				if (this.peek()?.v !== ')') {
					args.push(this.ternary());
					while (this.peek()?.v === ',') {
						this.next();
						args.push(this.ternary());
					}
				}
				this.eat(')');
				node = { k: 'call', callee: node, args };
			} else break;
		}
		return node;
	}

	private primary(): Node {
		const t = this.next();
		if (!t) throw new Error('Unexpected end of formula');
		if (t.t === 'num') return { k: 'lit', v: Number(t.v) };
		if (t.t === 'str') return { k: 'lit', v: t.v };
		if (t.v === '(') {
			const node = this.ternary();
			this.eat(')');
			return node;
		}
		if (t.t === 'id') {
			if (t.v === 'true') return { k: 'lit', v: true };
			if (t.v === 'false') return { k: 'lit', v: false };
			return { k: 'id', name: t.v };
		}
		throw new Error(`Unexpected token "${t.v}"`);
	}
}

// ---- evaluation ------------------------------------------------------------

function evalNode(node: Node, scope: FormulaScope): unknown {
	switch (node.k) {
		case 'lit':
			return node.v;
		case 'id':
			return scope[node.name];
		case 'member': {
			const obj = evalNode(node.obj, scope) as Record<string, unknown> | unknown[] | undefined;
			if (obj == null) return undefined;
			if (Array.isArray(obj) && node.prop in VEC_INDEX) return obj[VEC_INDEX[node.prop]];
			return (obj as Record<string, unknown>)[node.prop];
		}
		case 'call': {
			const fn = evalNode(node.callee, scope);
			const args = node.args.map((a) => evalNode(a, scope));
			return typeof fn === 'function' ? (fn as (...a: unknown[]) => unknown)(...args) : undefined;
		}
		case 'unary': {
			const v = evalNode(node.arg, scope);
			return node.op === '-' ? -(v as number) : !v;
		}
		case 'binary':
			return applyBinary(node.op, evalNode(node.left, scope), evalNode(node.right, scope));
		case 'cond':
			return evalNode(node.test, scope) ? evalNode(node.then, scope) : evalNode(node.else, scope);
	}
}

function applyBinary(op: string, a: unknown, b: unknown): unknown {
	const x = a as number;
	const y = b as number;
	switch (op) {
		case '+':
			return (a as number) + (b as number);
		case '-':
			return x - y;
		case '*':
			return x * y;
		case '/':
			return x / y;
		case '%':
			return x % y;
		case '<':
			return x < y;
		case '<=':
			return x <= y;
		case '>':
			return x > y;
		case '>=':
			return x >= y;
		case '==':
			return a === b;
		case '!=':
			return a !== b;
		case '&&':
			return a && b;
		case '||':
			return a || b;
		default:
			return undefined;
	}
}

function collectDeps(node: Node, into: Set<string>) {
	switch (node.k) {
		case 'id':
			into.add(node.name);
			break;
		case 'member':
			collectDeps(node.obj, into);
			break;
		case 'call':
			collectDeps(node.callee, into);
			node.args.forEach((a) => collectDeps(a, into));
			break;
		case 'unary':
			collectDeps(node.arg, into);
			break;
		case 'binary':
			collectDeps(node.left, into);
			collectDeps(node.right, into);
			break;
		case 'cond':
			collectDeps(node.test, into);
			collectDeps(node.then, into);
			collectDeps(node.else, into);
			break;
	}
}

/** Compile a formula string (with or without leading `=`) into a runnable form. */
export function compile(formula: string): CompiledFormula {
	const src = formula.startsWith('=') ? formula.slice(1) : formula;
	try {
		const ast = new Parser(tokenize(src)).parse();
		const deps = new Set<string>();
		collectDeps(ast, deps);
		return { src, deps: [...deps], eval: (scope) => evalNode(ast, scope) };
	} catch (error) {
		console.warn(`[formula] Failed to compile "${formula}":`, (error as Error).message);
		return { src, deps: [], eval: () => undefined };
	}
}

/** True when a value is a formula string. */
export function isFormula(value: unknown): value is string {
	return typeof value === 'string' && value.startsWith('=');
}
