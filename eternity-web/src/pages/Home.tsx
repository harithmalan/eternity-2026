import Layout from '../components/Layout';
import Hero from '../components/Hero';
import SealedGrid from '../components/SealedGrid';
import MerchGrid from '../components/MerchGrid';
import SizeChart from '../components/SizeChart';
import OrderForm from '../components/OrderForm';
import Steps from '../components/Steps';
import Contacts from '../components/Contacts';
import { useProducts, useSettings, useSizeChart } from '../hooks/useEternityData';

export default function Home() {
  const { products, loading: productsLoading } = useProducts();
  const { settings, loading: settingsLoading } = useSettings();
  const { sizes, loading: sizesLoading } = useSizeChart();

  return (
    <Layout>
      <Hero />
      <SealedGrid />
      <MerchGrid products={products} settings={settings} loading={productsLoading || settingsLoading} />
      <SizeChart sizes={sizes} loading={sizesLoading} />
      <OrderForm settings={settings} loading={settingsLoading} />
      <Steps />
      <Contacts />
    </Layout>
  );
}
