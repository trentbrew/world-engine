import { TenantPool, startServer, BlobStore } from 'trellis/server';
import { readConfig, defaultLocalConfig, writeConfig } from 'trellis/client';
console.log('imports-ok', !!TenantPool, !!startServer, !!BlobStore, !!readConfig, !!defaultLocalConfig, !!writeConfig);
