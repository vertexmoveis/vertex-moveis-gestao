import { z } from 'zod'

export const CONTRACT_DESCRIPTION_MAX_LENGTH = 20_000

export const contractSourceDocumentSchema = z.object({
  type: z.literal('PDF_QUOTE'),
  fileName: z.string().trim().min(5).max(180).regex(/^[^/\\\u0000-\u001f]+\.pdf$/i),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  pageCount: z.number().int().min(1).max(20),
  text: z.string().trim().min(1).max(CONTRACT_DESCRIPTION_MAX_LENGTH),
}).strict()

/** Private import history. Only the reviewed description belongs in the public contract. */
export type ContractSourceDocument = z.infer<typeof contractSourceDocumentSchema>
