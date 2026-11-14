import assert from 'node:assert/strict'
import test from 'node:test'
import { DEVELOPMENT_WEB_URL, navigationAction, resolveWebUrl } from '../src/web-policy'

test('development defaults to the local web server, preserving a configured path', () => {
  assert.equal(resolveWebUrl(undefined, true), DEVELOPMENT_WEB_URL)
  assert.equal(
    resolveWebUrl(' https://room.example/app?q=1 ', false),
    'https://room.example/app?q=1',
  )
})
test('release requires explicit HTTPS and refuses credentials and executable URLs', () => {
  for (const url of [
    undefined,
    '',
    'http://room.example/',
    'javascript:alert(1)',
    'file:///etc/passwd',
    'https://user:secret@room.example',
    'not a url',
  ]) {
    assert.throws(() => resolveWebUrl(url, false))
  }
})
test('only exact web origin stays in the WebView; external HTTPS opens browser', () => {
  const web = DEVELOPMENT_WEB_URL
  assert.equal(navigationAction(`${web}music#current`, web), 'internal')
  assert.equal(navigationAction('https://example.com/help', web), 'external')
  assert.equal(navigationAction('https://localhost:3000/', web), 'external')
  for (const url of [
    'http://example.com',
    'intent://open',
    'javascript:alert(1)',
    'data:text/html,x',
    'file:///x',
    'https://u:p@example.com',
    'about:blank',
    'bad',
  ]) {
    assert.equal(navigationAction(url, web), 'block', url)
  }
})
