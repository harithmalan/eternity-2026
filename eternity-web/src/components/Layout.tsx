import { lazy, Suspense, type ReactNode } from 'react';
import Halo from './Halo';
import Nav from './Nav';
import Footer from './Footer';
import LiveCount from './LiveCount';

const Cosmos = lazy(() => import('../three/Cosmos'));

/** The site chrome shared by every real page: the 3D scene, nav, and footer. */
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <Suspense fallback={null}>
        <Cosmos />
      </Suspense>
      <div className="meridian" />
      <Halo />

      <Nav />
      {children}
      <Footer />
      <LiveCount />
    </>
  );
}
