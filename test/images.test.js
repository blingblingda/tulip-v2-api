const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PassThrough } = require('node:stream');
const fs = require('node:fs/promises');
const express = require('express');
let uploadError = false;
let lastPath;
require.cache[require.resolve('../s3')] = { exports: {
  uploadFile: async (file) => {
    lastPath = file.path;
    if (uploadError) throw new Error('Storage failure');
    return { Key: 'test-key', Location: 'https://private-bucket.invalid/test-key' };
  },
  getFileStream: (key) => {
    const stream = new PassThrough();
    process.nextTick(() => {
      if (key === 'missing') return stream.destroy(Object.assign(new Error(), { code: 'NoSuchKey' }));
      if (key === 'denied') return stream.destroy(Object.assign(new Error(), { code: 'AccessDenied' }));
      stream.emit('contentType', 'image/png');
      stream.end(Buffer.from('image-bytes'));
    });
    return stream;
  }
}};

test('private image upload and retrieval contract', async () => {
  const app = express(); app.use('/api/images', require('../routes/images'));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const previous = process.env.PUBLIC_API_URL;
  process.env.PUBLIC_API_URL = 'https://api.example.com/';
  const form = () => { const f = new FormData(); f.append('image', new Blob(['image-bytes'], {type:'image/png'}), 'test.png'); return f; };
  try {
    let r = await fetch(`${origin}/api/images`, {method:'POST', body:form()});
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), {photo_url:'https://api.example.com/api/images/test-key'});
    r = await fetch(`${origin}/api/images/test-key`);
    assert.equal(r.headers.get('content-type'), 'image/png');
    assert.equal(await r.text(), 'image-bytes');
    await assert.rejects(fs.access(lastPath));
    r = await fetch(`${origin}/api/images`, {method:'POST'}); assert.equal(r.status,400);
    r = await fetch(`${origin}/api/images/missing`); assert.equal(r.status,404);
    r = await fetch(`${origin}/api/images/denied`); assert.equal(r.status,502);
    uploadError = true;
    r = await fetch(`${origin}/api/images`, {method:'POST',body:form()}); assert.equal(r.status,502);
    await r.json();
    // A subsequent request lets the asynchronous upload cleanup finish.
    await fetch(`${origin}/api/images/test-key`);
    await assert.rejects(fs.access(lastPath));
  } finally {
    if (previous === undefined) delete process.env.PUBLIC_API_URL; else process.env.PUBLIC_API_URL = previous;
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  }
});
