import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { STORAGE_PREFIX } from '@/constants'
import { seedCommodities } from '@/data/commodities'
import {
  createCommodity,
  fetchPriceHistory,
  isApiConfigured,
  updateCommodityPriceRange,
  uploadCommodityImage,
} from '@/lib/api'
import { generateId } from '@/lib/utils'
import type { Commodity, CommodityFormInput, PriceHistoryEntry } from '@/types'

interface CommodityState {
  commodities: Commodity[]
  priceHistory: PriceHistoryEntry[]
  /** `photoError` is set when the commodity saved but its photo failed to upload. */
  addCommodity: (
    input: CommodityFormInput,
    imageFile?: File | null,
  ) => Promise<
    | { ok: true; commodity: Commodity; photoError?: string }
    | { ok: false; message: string }
  >
  uploadPhoto: (
    commodityId: string,
    file: File,
  ) => Promise<{ ok: true } | { ok: false; message: string }>
  updatePriceRange: (input: {
    commodityId: string
    priceMin: number
    priceMax: number
    effectiveFrom: string
    note?: string
  }) => Promise<{ ok: true } | { ok: false; message: string }>
  resetCommodities: () => void
}

export const useCommodityStore = create<CommodityState>()(
  persist(
    (set, get) => ({
      commodities: isApiConfigured() ? [] : seedCommodities,
      priceHistory: [],
      addCommodity: async (input, imageFile) => {
        const name = input.name.trim()
        const description = input.description.trim()
        const imageUrl = input.imageUrl.trim()
        if (!name) return { ok: false, message: 'Commodity name is required.' }
        if (!description) {
          return { ok: false, message: 'Description is required.' }
        }
        if (
          !Number.isFinite(input.priceMin) ||
          !Number.isFinite(input.priceMax) ||
          input.priceMin <= 0 ||
          input.priceMax <= 0
        ) {
          return { ok: false, message: 'Enter a valid price range.' }
        }
        if (input.priceMin > input.priceMax) {
          return { ok: false, message: 'Min price cannot exceed max price.' }
        }
        const hasUploadablePhoto = Boolean(imageFile) && isApiConfigured()
        if (!imageUrl && !hasUploadablePhoto) {
          return { ok: false, message: 'Upload a photo or enter an image URL.' }
        }

        if (isApiConfigured()) {
          try {
            let commodity = await createCommodity(input)
            set({ commodities: [commodity, ...get().commodities] })
            let photoError: string | undefined
            if (imageFile) {
              try {
                const uploadedUrl = await uploadCommodityImage(commodity.id, imageFile)
                commodity = { ...commodity, imageUrl: uploadedUrl }
                set({
                  commodities: get().commodities.map((c) =>
                    c.id === commodity.id ? commodity : c,
                  ),
                })
              } catch (error) {
                photoError =
                  error instanceof Error
                    ? error.message
                    : 'The photo could not be uploaded.'
              }
            }
            return { ok: true, commodity, photoError }
          } catch (error) {
            return {
              ok: false,
              message:
                error instanceof Error
                  ? error.message
                  : 'Unable to create commodity.',
            }
          }
        }

        const duplicate = get().commodities.some(
          (c) => c.name.toLowerCase() === name.toLowerCase(),
        )
        if (duplicate) {
          return { ok: false, message: 'A commodity with that name already exists.' }
        }

        const now = new Date().toISOString()
        const commodity: Commodity = {
          id: generateId('COMM'),
          name,
          description,
          category: input.category,
          unit: input.unit,
          priceMin: Number(input.priceMin.toFixed(2)),
          priceMax: Number(input.priceMax.toFixed(2)),
          imageUrl,
          effectiveFrom: now,
          isActive: input.isActive,
        }

        set({ commodities: [commodity, ...get().commodities] })
        return { ok: true, commodity }
      },
      uploadPhoto: async (commodityId, file) => {
        if (!isApiConfigured()) {
          return { ok: false, message: 'Photo upload needs the API connection.' }
        }
        try {
          const imageUrl = await uploadCommodityImage(commodityId, file)
          set({
            commodities: get().commodities.map((c) =>
              c.id === commodityId ? { ...c, imageUrl } : c,
            ),
          })
          return { ok: true }
        } catch (error) {
          return {
            ok: false,
            message:
              error instanceof Error
                ? error.message
                : 'The photo could not be uploaded.',
          }
        }
      },
      updatePriceRange: async ({
        commodityId,
        priceMin,
        priceMax,
        effectiveFrom,
        note,
      }) => {
        if (
          !Number.isFinite(priceMin) ||
          !Number.isFinite(priceMax) ||
          priceMin <= 0 ||
          priceMax <= 0
        ) {
          return { ok: false, message: 'Enter a valid price range.' }
        }
        if (priceMin > priceMax) {
          return { ok: false, message: 'Min price cannot exceed max price.' }
        }
        const commodity = get().commodities.find((c) => c.id === commodityId)
        if (!commodity) return { ok: false, message: 'Commodity not found.' }

        if (isApiConfigured()) {
          try {
            const updated = await updateCommodityPriceRange({
              commodityId,
              priceMin,
              priceMax,
              effectiveFrom,
            })
            let history = get().priceHistory
            try {
              history = await fetchPriceHistory()
            } catch {
              history = [
                {
                  id: generateId('PRICE'),
                  commodityId,
                  previousPriceMin: commodity.priceMin,
                  previousPriceMax: commodity.priceMax,
                  newPriceMin: updated.priceMin,
                  newPriceMax: updated.priceMax,
                  effectiveFrom,
                  changedAt: new Date().toISOString(),
                  note,
                },
                ...history,
              ]
            }
            set({
              commodities: get().commodities.map((c) =>
                c.id === commodityId ? updated : c,
              ),
              priceHistory: history,
            })
            return { ok: true }
          } catch (error) {
            return {
              ok: false,
              message:
                error instanceof Error
                  ? error.message
                  : 'Unable to update price range.',
            }
          }
        }

        const entry: PriceHistoryEntry = {
          id: generateId('PRICE'),
          commodityId,
          previousPriceMin: commodity.priceMin,
          previousPriceMax: commodity.priceMax,
          newPriceMin: Number(priceMin.toFixed(2)),
          newPriceMax: Number(priceMax.toFixed(2)),
          effectiveFrom,
          changedAt: new Date().toISOString(),
          note,
        }

        set({
          commodities: get().commodities.map((c) =>
            c.id === commodityId
              ? {
                  ...c,
                  priceMin: entry.newPriceMin,
                  priceMax: entry.newPriceMax,
                  effectiveFrom,
                }
              : c,
          ),
          priceHistory: [entry, ...get().priceHistory],
        })
        return { ok: true }
      },
      resetCommodities: () =>
        set({
          commodities: isApiConfigured() ? [] : structuredClone(seedCommodities),
          priceHistory: [],
        }),
    }),
    {
      name: `${STORAGE_PREFIX}-commodities`,
      // API mode: catalog comes from Strapi. Don't rehydrate a stale local
      // copy that can wipe commodities after create + refresh.
      partialize: (state) =>
        isApiConfigured()
          ? {}
          : {
              commodities: state.commodities,
              priceHistory: state.priceHistory,
            },
      merge: (persisted, current) => {
        if (isApiConfigured()) return { ...current }
        const p = persisted as Partial<CommodityState> | undefined
        return { ...current, ...p }
      },
    },
  ),
)
