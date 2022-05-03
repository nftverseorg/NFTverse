//@ts-nocheck
import Document, { Html, Head, Main, NextScript } from "next/document"; // Document

/**
 * Exports custom document to inject Head
 */
export default class NFTverseBankDocument extends Document {
  render() {
    return (
      <Html>
        {/* Custom Head */}
        <Head>
          {/* General Meta */}
          <title>NFTverse</title>
          <meta name="title" content="NFTverse" />
          <meta
            name="description"
            content="NFTverse: The smartest way to own Digital Assets & NFTs"
          />

          {/* Open Graph + Facebook */}
          <meta property="og:type" content="website" />
          <meta property="og:url" content="https://demo.nftverse.org/" />
          <meta
            property="og:title"
            content="NFTverse — The smartest way to own Digital Assets or NFTs"
          />
          <meta
            property="og:description"
            content="NFTverse: The smartest way to own Digital Assets & NFTs"
          />
          <meta property="og:image" content="https://demo.nftverse.org/meta.png" />

          {/* Twitter */}
          <meta property="twitter:card" content="summary_large_image" />
          <meta property="twitter:url" content="https://demo.nftverse.org"/>
          <meta
            property="twitter:title"
            content="NFTverse — The smartest way to own Digital Assets or NFTs"
          />
          <meta
            property="twitter:description"
            content="NFTverse: The smartest way to own Digital Assets & NFTs"
          />
          <meta property="twitter:image" content="https://demo.nftverse.org/meta.png" />

          {/* Fonts */}
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link
            rel="preconnect"
            href="https://fonts.gstatic.com"
            crossOrigin="true"
          />
          <link
            href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700&display=swap"
            rel="stylesheet"
          />

          {/* Favicon */}
          <link rel="shortcut icon" href="/static/favicon.ico" />
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}
