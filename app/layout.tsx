import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: 'SikshaSajilo — सिक्ने सजिलो तरिका',
  description:
    'AI-powered tutor for Nepal SEE students. Learn Mathematics, Science, English, Nepali, and Social Studies — grounded in the official CDC syllabus.',
};

// Runs synchronously in <head> before any JS bundle loads.
// Strips non-Latin1 chars (> U+00FF) — e.g. a BOM-prefixed Supabase anon key —
// from ALL header paths: Headers constructor, .set(), .append(), and fetch init.
// The error "Cannot convert argument to a ByteString" / "non ISO-8859-1"
// fires in new Headers({...}) BEFORE window.fetch is reached, so we must
// patch the Headers class itself, not only window.fetch.
const fetchPatch = `(function(){
  function san(s){ return String(s).replace(/[^\\x00-\\xFF]/g,''); }

  // 1 — Patch Headers.prototype so .set() and .append() sanitize values
  var HP = window.Headers.prototype;
  var _set = HP.set, _app = HP.append;
  HP.set    = function(n,v){ return _set.call(this,    n, san(v)); };
  HP.append = function(n,v){ return _app.call(this,    n, san(v)); };

  // 2 — Patch the Headers constructor so new Headers({...}) sanitizes values
  var OrigH = window.Headers;
  window.Headers = function(init){
    if (!init) return new OrigH();
    if (init instanceof OrigH) return new OrigH(init);
    var s;
    if (Array.isArray(init)){
      s = init.map(function(p){ return [p[0], san(p[1])]; });
    } else if (typeof init.forEach === 'function'){
      s = {}; init.forEach(function(v,k){ s[k]=san(v); });
    } else {
      s = {}; Object.keys(init).forEach(function(k){ s[k]=san(init[k]); });
    }
    return new OrigH(s);
  };
  window.Headers.prototype = OrigH.prototype;

  // 3 — Patch window.fetch as an extra safety net for plain-object headers
  var origF = window.fetch;
  window.fetch = function(input, init){
    if (init && init.headers){
      var src=init.headers, c={};
      try {
        if (typeof src.forEach==='function') src.forEach(function(v,k){ c[k]=san(v); });
        else Object.keys(src).forEach(function(k){ c[k]=san(src[k]); });
      } catch(_){}
      return origF.call(this, input, Object.assign({},init,{headers:c}));
    }
    return origF.apply(this, arguments);
  };
})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script dangerouslySetInnerHTML={{ __html: fetchPatch }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
