import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Layout from '../components/Layout';
import Hero from '../components/Hero';
import SealedGrid from '../components/SealedGrid';
import MerchGrid from '../components/MerchGrid';
import SizeChart from '../components/SizeChart';
import OrderForm from '../components/OrderForm';
import Steps from '../components/Steps';
import Contacts from '../components/Contacts';
import { useBatches, useProducts, useSettings, useSizeChart } from '../hooks/useEternityData';

export default function Home() {
  const { products, loading: productsLoading } = useProducts();
  const { settings, loading: settingsLoading } = useSettings();
  const { sizes, loading: sizesLoading } = useSizeChart();
  const { batches, loading: batchesLoading } = useBatches();
  const location = useLocation();

  // A "Choose the X" card or a cross-page "Pre-order merch" link lands here
  // with a #order hash — the browser only auto-scrolls to it on a hard
  // navigation, not on this SPA's client-side route changes.
  useEffect(() => {
    if (!location.hash) return;
    const id = location.hash.slice(1);
    const t = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
    return () => window.clearTimeout(t);
  }, [location.hash, location.key]);

  return (
    <Layout>
      <Hero />
      <SealedGrid />
      <MerchGrid products={products} settings={settings} loading={productsLoading || settingsLoading} />
      <SizeChart sizes={sizes} loading={sizesLoading} />
      <OrderForm products={products} settings={settings} batches={batches} loading={productsLoading || settingsLoading || batchesLoading} />
      <Steps />
      <Contacts />
    </Layout>
  );
}
