import { authenticate, type SessionReader } from './identity'
import { AppError } from './errors'
import { assertSameOrigin, errorResponse, jsonInput, privateResponse, stringField } from './http'
import type { Workspace } from './workspace'
import type { ImportReview } from '../domain/imports/review'

export function reviewPage(review: ImportReview, page: number) {
  const pageSize = 100
  return { ...review, records: review.records.slice((page - 1) * pageSize, page * pageSize),
    issues: review.issues.slice(0, 100), issueCount: review.issues.length, page, pageSize }
}

export function createWorkspaceHandler(workspace: Workspace, readSession: SessionReader, origin: string) {
  return async (request: Request): Promise<Response> => {
    try {
      if (request.method !== 'POST') return privateResponse({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST.' } }, 405)
      assertSameOrigin(request, origin)
      const identity = await authenticate(request.headers, readSession)
      const input = await jsonInput(request)
      await workspace.consumeRequest(identity, 'general')
      if (input.action === 'prepare-import' || input.action === 'review-import' || input.action === 'commit-import') await workspace.consumeRequest(identity, 'upload')
      if (input.action === 'calculate') await workspace.consumeRequest(identity, 'calculate')
      const text = (name: string) => stringField(input, name)
      switch (input.action) {
        case 'import-history': return privateResponse(await workspace.importHistory(identity, Number(input.page ?? 1)))
        case 'overview': return privateResponse(await workspace.overview(identity))
        case 'add-account': return privateResponse(await workspace.addAccount(identity, {
          portfolioId: text('portfolioId'), broker: text('broker'), label: text('label'), accountType: text('accountType'),
        }), 201)
        case 'prepare-import': {
          const format = text('format')
          if (format !== 'native' && format !== 'canonical-v1') throw new AppError(400, 'INVALID_FORMAT', 'Choose the file format.')
          if (input.ordinarySharesConfirmed !== undefined && typeof input.ordinarySharesConfirmed !== 'boolean') throw new AppError(400, 'INVALID_CONFIRMATION', 'Use the ordinary-share confirmation checkbox.')
          const result = await workspace.prepareImport(identity, { accountId: text('accountId'), csv: text('csv'), format, ordinarySharesConfirmed: input.ordinarySharesConfirmed as boolean | undefined })
          return privateResponse({ ...result, review: reviewPage(result.review, 1) }, 201)
        }
        case 'review-import': {
          const page = Number(input.page ?? 1)
          if (!Number.isSafeInteger(page) || page < 1 || page > 1000) throw new AppError(400, 'INVALID_PAGE', 'Choose a valid review page.')
          const result = await workspace.reviewImport(identity, text('draftId'))
          return privateResponse({ ...result, review: reviewPage(result.review, page) })
        }
        case 'discard-draft':
          await workspace.discardDraft(identity, text('draftId'))
          return privateResponse({ discarded: true })
        case 'commit-import': {
          if (typeof input.revision !== 'number') throw new AppError(400, 'INVALID_REVISION', 'Review this file again before importing.')
          const result = await workspace.commitImport(identity, text('draftId'), input.revision)
          if (result.outcome === 'review_changed' || result.outcome === 'needs_review') return privateResponse({ ...result, review: reviewPage(result.review, 1) }, 409)
          return privateResponse(result)
        }
        case 'reverse-import': return privateResponse(await workspace.reverseImport(identity, text('importId'), text('reason')))
        case 'calculate': {
          if (!Array.isArray(input.confirmedAccountIds) || !input.confirmedAccountIds.every(id => typeof id === 'string')) {
            throw new AppError(400, 'INVALID_COVERAGE', 'Confirm the accounts whose history is complete.')
          }
          return privateResponse(await workspace.calculate(identity, { portfolioId: text('portfolioId'), taxYear: text('taxYear'),
            historyThrough: text('historyThrough'), confirmedAccountIds: input.confirmedAccountIds }))
        }
        default: throw new AppError(400, 'INVALID_ACTION', 'Choose an available action.')
      }
    } catch (error) { return errorResponse(error) }
  }
}
