import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* Font optimization */}
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        
        {/* Preload fonts */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </Head>
      <body>
        {/* Loading indicator */}
        <script dangerouslySetInnerHTML={{
          __html: `
            // Mark page as loaded once content appears
            window.addEventListener('load', function() {
              document.body.classList.add('page-loaded');
            }, { once: true });
            
            // Also mark as loaded when DOM is ready
            if (document.readyState === 'loading') {
              document.addEventListener('DOMContentLoaded', function() {
                document.body.classList.add('page-loaded');
              }, { once: true });
            } else {
              document.body.classList.add('page-loaded');
            }
          `
        }} />
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
