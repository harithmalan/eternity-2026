import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import type { AdminOrderRow } from '../lib/database.types';
import { STATUS_LABEL } from '../components/OrderFilterBar';
import type { ExportMerchSummary } from '../hooks/useExportMerchSummary';

// The site's wordmark PNG is chrome-on-transparent, built for the void
// background — on white paper it's nearly invisible. The report is
// deliberately black-on-white (it gets printed), so the wordmark here is
// set in Bodoni Moda instead of the image asset; the SCU 25 mark's own
// navy/gold artwork works fine on white as-is, so that one is the real PNG.
const styles = StyleSheet.create({
  page: { backgroundColor: '#ffffff', color: '#111111', padding: 36, fontFamily: 'Helvetica', fontSize: 9 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  wordmark: { fontFamily: 'Bodoni Moda', fontSize: 28, color: '#0a0a0a' },
  scuMark: { height: 30, width: 'auto' },
  meta: { fontFamily: 'Chivo Mono', fontSize: 8, color: '#666666', textAlign: 'right' },
  goldRule: { height: 2, backgroundColor: '#F2B01E', marginVertical: 16 },
  reportTitle: { fontFamily: 'Bodoni Moda', fontSize: 16, marginBottom: 2 },
  reportSubtitle: { fontFamily: 'Chivo Mono', fontSize: 8, color: '#666666', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 },
  sectionTitle: { fontFamily: 'Bodoni Moda', fontSize: 13, marginTop: 22, marginBottom: 8 },
  merchSummary: { marginTop: 6, borderWidth: 0.5, borderColor: '#d6d6d6', padding: 12 },
  merchTitle: { fontFamily: 'Chivo Mono', fontSize: 8, letterSpacing: 1, textTransform: 'uppercase', color: '#111111', marginBottom: 8 },
  merchRow: { flexDirection: 'row', paddingVertical: 3 },
  merchProduct: { width: '56%', fontSize: 8.5, color: '#222222' },
  merchUnits: { width: '18%', fontFamily: 'Chivo Mono', fontSize: 8, color: '#222222', textAlign: 'right' },
  merchRevenue: { width: '26%', fontFamily: 'Chivo Mono', fontSize: 8, color: '#222222', textAlign: 'right' },
  merchRule: { height: 0.5, backgroundColor: '#bbbbbb', marginVertical: 7 },
  merchTotalLabel: { width: '74%', fontFamily: 'Chivo Mono', fontSize: 7.5, letterSpacing: 0.4, color: '#111111' },
  merchTotalValue: { width: '26%', fontFamily: 'Chivo Mono', fontSize: 8.5, color: '#111111', textAlign: 'right' },
  clarifier: { fontSize: 7.5, color: '#777777', lineHeight: 1.45, marginTop: 9 },
  thRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#111111', paddingBottom: 5, marginBottom: 2 },
  th: { fontFamily: 'Chivo Mono', fontSize: 7, letterSpacing: 0.6, textTransform: 'uppercase', color: '#888888' },
  tr: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#dddddd', paddingVertical: 5 },
  td: { fontSize: 8.5, color: '#222222' },
  tdEmph: { fontSize: 8.5, color: '#0a0a0a', fontFamily: 'Chivo Mono' },
  footer: {
    position: 'absolute', bottom: 20, left: 36, right: 36, flexDirection: 'row', justifyContent: 'space-between',
    fontFamily: 'Chivo Mono', fontSize: 7, color: '#999999', borderTopWidth: 0.5, borderTopColor: '#dddddd', paddingTop: 8,
  },
});

export interface SizeBreakdownEntry { size: string; units: number }
export interface BatchBreakdownEntry { batch: string; orders: number; value: number }

interface Props {
  orders: AdminOrderRow[];
  sizeBreakdown: SizeBreakdownEntry[];
  batchBreakdown: BatchBreakdownEntry[];
  filterSummary: string;
  generatedAt: Date;
  merchSummary: ExportMerchSummary;
}

function money(n: number): string {
  return 'Rs ' + Math.round(n).toLocaleString('en-LK');
}

function Header({ generatedAt, filterSummary }: { generatedAt: Date; filterSummary: string }) {
  return (
    <View fixed>
      <View style={styles.headerRow}>
        <Text style={styles.wordmark}>Eternity</Text>
        <Image style={styles.scuMark} src="/img/scu-25.png" />
      </View>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.reportTitle}>Order report</Text>
          <Text style={styles.reportSubtitle}>{filterSummary}</Text>
        </View>
        <Text style={styles.meta}>Generated {generatedAt.toLocaleString('en-LK')}</Text>
      </View>
      <View style={styles.goldRule} />
    </View>
  );
}

export default function OrdersReport({ orders, sizeBreakdown, batchBreakdown, filterSummary, generatedAt, merchSummary }: Props) {

  return (
    <Document title={`Eternity orders — ${generatedAt.toISOString().slice(0, 10)}`}>
      <Page size="A4" style={styles.page} wrap>
        <Header generatedAt={generatedAt} filterSummary={filterSummary} />

        <View style={styles.merchSummary}>
          <Text style={styles.merchTitle}>Merch sold (paid orders only)</Text>
          {merchSummary.products.map((product) => (
            <View style={styles.merchRow} key={product.slug}>
              <Text style={styles.merchProduct}>{product.name}</Text>
              <Text style={styles.merchUnits}>{Number(product.units_sold).toLocaleString('en-LK')} units</Text>
              <Text style={styles.merchRevenue}>{money(Number(product.revenue))}</Text>
            </View>
          ))}
          <View style={styles.merchRule} />
          <View style={styles.merchRow}><Text style={styles.merchTotalLabel}>TOTAL TEES (INCL. BUNDLES)</Text><Text style={styles.merchTotalValue}>{merchSummary.totalTees.toLocaleString('en-LK')}</Text></View>
          <View style={styles.merchRow}><Text style={styles.merchTotalLabel}>TOTAL BANDS (INCL. BUNDLES)</Text><Text style={styles.merchTotalValue}>{merchSummary.totalBands.toLocaleString('en-LK')}</Text></View>
          <View style={styles.merchRow}><Text style={styles.merchTotalLabel}>TOTAL CONFIRMED REVENUE</Text><Text style={styles.merchTotalValue}>{money(merchSummary.confirmedRevenue)}</Text></View>
          <Text style={styles.clarifier}>
            This summary counts approved orders only, with bundles split into their tee and wristband. The order table below lists every order regardless of status - {merchSummary.awaitingPayment} still awaiting payment, {merchSummary.rejected} rejected - which is why its own totals run higher.
          </Text>
        </View>

        {sizeBreakdown.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Size breakdown</Text>
            <View style={styles.thRow}>
              <Text style={[styles.th, { width: '50%' }]}>Size</Text>
              <Text style={[styles.th, { width: '50%' }]}>Units</Text>
            </View>
            {sizeBreakdown.map((s) => (
              <View style={styles.tr} key={s.size}>
                <Text style={[styles.tdEmph, { width: '50%' }]}>{s.size}</Text>
                <Text style={[styles.td, { width: '50%' }]}>{s.units}</Text>
              </View>
            ))}
          </>
        )}

        {batchBreakdown.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Batch breakdown</Text>
            <View style={styles.thRow}>
              <Text style={[styles.th, { width: '50%' }]}>Batch</Text>
              <Text style={[styles.th, { width: '25%' }]}>Orders</Text>
              <Text style={[styles.th, { width: '25%' }]}>Value</Text>
            </View>
            {batchBreakdown.map((b) => (
              <View style={styles.tr} key={b.batch}>
                <Text style={[styles.tdEmph, { width: '50%' }]}>{b.batch}</Text>
                <Text style={[styles.td, { width: '25%' }]}>{b.orders}</Text>
                <Text style={[styles.td, { width: '25%' }]}>{money(b.value)}</Text>
              </View>
            ))}
          </>
        )}

        <Text style={styles.sectionTitle}>Orders</Text>
        <View style={styles.thRow} fixed>
          <Text style={[styles.th, { width: '13%' }]}>Code</Text>
          <Text style={[styles.th, { width: '18%' }]}>Name</Text>
          <Text style={[styles.th, { width: '14%' }]}>Batch / Center</Text>
          <Text style={[styles.th, { width: '25%' }]}>Items</Text>
          <Text style={[styles.th, { width: '10%' }]}>Total</Text>
          <Text style={[styles.th, { width: '12%' }]}>Status</Text>
          <Text style={[styles.th, { width: '8%' }]}>Date</Text>
        </View>
        {orders.map((o) => (
          <View style={styles.tr} key={o.code} wrap={false}>
            <Text style={[styles.tdEmph, { width: '13%' }]}>{o.code}</Text>
            <Text style={[styles.td, { width: '18%' }]}>{o.full_name}</Text>
            <Text style={[styles.td, { width: '14%' }]}>{o.batch ?? o.center}</Text>
            <Text style={[styles.td, { width: '25%' }]}>{o.items ?? '—'}</Text>
            <Text style={[styles.td, { width: '10%' }]}>{money(Number(o.total))}</Text>
            <Text style={[styles.td, { width: '12%' }]}>{STATUS_LABEL[o.status] ?? o.status}</Text>
            <Text style={[styles.td, { width: '8%' }]}>{new Date(o.created_at).toLocaleDateString('en-LK')}</Text>
          </View>
        ))}

        <View style={styles.footer} fixed>
          <Text>Eternity · SCU Get Together 2026</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
