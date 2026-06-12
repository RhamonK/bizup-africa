import AsyncStorage from '@react-native-async-storage/async-storage'
import { addToQueue, getQueue, flushQueue, addStockEntryToQueue, flushStockQueue, QueuedSale } from '../offlineQueue'
import { createSale } from '../../services/sales'
import { supabase } from '../supabase'

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
)
jest.mock('../../services/sales', () => ({ createSale: jest.fn() }))
jest.mock('../supabase', () => ({
  supabase: { from: jest.fn(), rpc: jest.fn() },
}))

const mockCreateSale = createSale as jest.MockedFunction<typeof createSale>
const mockRpc = supabase.rpc as jest.Mock
const mockFrom = supabase.from as jest.Mock

const sale: Omit<QueuedSale, 'queued_at'> = {
  shop_id: 'shop-1',
  created_by: 'agent-1',
  total_amount: 5000,
  paid_amount: 3000,
  credit_amount: 2000,
  date: '2026-06-12',
  product_id: 'prod-1',
  product_name: 'Tomates',
  product_unit: 'caisse',
  qty: 2,
  unit_price: 2500,
  pay_mode: 'cash',
  client_name: 'Ama',
}

beforeEach(async () => {
  await AsyncStorage.clear()
  jest.clearAllMocks()
})

describe('file de ventes hors-ligne', () => {
  it('empile et relit les ventes en attente', async () => {
    await addToQueue(sale)
    const queue = await getQueue()
    expect(queue).toHaveLength(1)
    expect(queue[0].product_name).toBe('Tomates')
    expect(queue[0].queued_at).toBeTruthy()
  })

  it('vide la file via la RPC transactionnelle quand tout passe', async () => {
    mockCreateSale.mockResolvedValue({ data: { id: 's1' }, error: null })
    await addToQueue(sale)
    await addToQueue({ ...sale, client_name: null })

    const flushed = await flushQueue('shop-1')

    expect(flushed).toBe(2)
    expect(mockCreateSale).toHaveBeenCalledTimes(2)
    expect(mockCreateSale).toHaveBeenCalledWith('shop-1', 'agent-1', expect.objectContaining({
      total_amount: 5000,
      items: [expect.objectContaining({ product_id: 'prod-1', quantity: 2 })],
    }))
    expect(await getQueue()).toHaveLength(0)
  })

  it('garde en file les ventes qui échouent', async () => {
    mockCreateSale.mockResolvedValue({ data: null, error: { message: 'réseau' } } as unknown as Awaited<ReturnType<typeof createSale>>)
    await addToQueue(sale)

    const flushed = await flushQueue('shop-1')

    expect(flushed).toBe(0)
    expect(await getQueue()).toHaveLength(1)
  })
})

describe('file de stock hors-ligne', () => {
  const entry = {
    shop_id: 'shop-1',
    product_id: 'prod-1',
    quantity: 5,
    cost_per_unit: 1000,
    date: '2026-06-12',
    supplier_id: null,
  }

  it('insère l\'arrivage puis incrémente le stock atomiquement', async () => {
    mockFrom.mockReturnValue({ insert: jest.fn().mockResolvedValue({ error: null }) })
    mockRpc.mockResolvedValue({ error: null })
    await addStockEntryToQueue(entry)

    const flushed = await flushStockQueue('shop-1')

    expect(flushed).toBe(1)
    expect(mockRpc).toHaveBeenCalledWith('increment_stock', { p_id: 'prod-1', qty: 5 })
  })

  it('garde l\'arrivage en file si l\'incrément échoue', async () => {
    mockFrom.mockReturnValue({ insert: jest.fn().mockResolvedValue({ error: null }) })
    mockRpc.mockResolvedValue({ error: { message: 'réseau' } })
    await addStockEntryToQueue(entry)

    const flushed = await flushStockQueue('shop-1')

    expect(flushed).toBe(0)
  })
})
