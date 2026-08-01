import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const PRIVATE_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
]);

function privateIpv4(address: string): boolean {
  const octets = address.split('.').map(Number);
  if (
    octets.length !== 4 ||
    octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return true;
  }
  const [a, b] = octets;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 0 || b === 168)) ||
    (a === 198 && b >= 18 && b <= 19) ||
    (a === 203 && b === 0) ||
    a >= 224
  );
}

function privateIpv6(address: string): boolean {
  const normalized = address.toLowerCase();
  if (
    normalized === '::' ||
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe8') ||
    normalized.startsWith('fe9') ||
    normalized.startsWith('fea') ||
    normalized.startsWith('feb')
  ) {
    return true;
  }
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(normalized);
  return mapped ? privateIpv4(mapped[1]) : false;
}

export function validateWebhookUrlSyntax(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Webhook URL is invalid');
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Webhook URL must use http/https without credentials');
  }
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (PRIVATE_HOSTNAMES.has(hostname) || hostname.endsWith('.localhost')) {
    throw new Error('Webhook URL targets a private host');
  }
  const ipVersion = isIP(hostname);
  if ((ipVersion === 4 && privateIpv4(hostname)) || (ipVersion === 6 && privateIpv6(hostname))) {
    throw new Error('Webhook URL targets a private address');
  }
  return url;
}

export async function assertSafeWebhookUrl(
  value: string,
  allowedHosts: string[] = [],
): Promise<URL> {
  const url = validateWebhookUrlSyntax(value);
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    allowedHosts.length > 0 &&
    !allowedHosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))
  ) {
    throw new Error('Webhook host is not allowlisted');
  }
  if (isIP(host)) {
    return url;
  }
  const addresses = await lookup(host, { all: true, verbatim: true });
  if (
    addresses.length === 0 ||
    addresses.some(({ address }) =>
      isIP(address) === 4 ? privateIpv4(address) : privateIpv6(address),
    )
  ) {
    throw new Error('Webhook URL resolves to a private address');
  }
  return url;
}

export const WEBHOOK_HEADER_DENYLIST = new Set([
  'connection',
  'content-length',
  'host',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);
