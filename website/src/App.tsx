import { Nav } from './components/Nav'
import { Hero } from './components/Hero'
import { Features } from './components/Features'
import { Pipeline } from './components/Pipeline'
import { Showcase } from './components/Showcase'
import { Downloads } from './components/Downloads'
import { WhySentinel } from './components/WhySentinel'
import { Documentation } from './components/Documentation'
import { Roadmap } from './components/Roadmap'
import { FAQ } from './components/FAQ'
import { OpenSource } from './components/OpenSource'
import { Footer } from './components/Footer'

export function App() {
  return (
    <>
      <a
        href="#main-content"
        className="skip-link"
      >
        Skip to main content
      </a>

      <Nav />

      <main id="main-content">
        <Hero />
        <Features />
        <Pipeline />
        <Showcase />
        <Downloads />
        <WhySentinel />
        <Documentation />
        <Roadmap />
        <FAQ />
        <OpenSource />
      </main>

      <Footer />
    </>
  )
}
