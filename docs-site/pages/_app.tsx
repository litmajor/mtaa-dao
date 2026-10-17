import type { AppProps } from 'next/app'
import '../styles/docs-logo.css'

export default function App({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />
}
