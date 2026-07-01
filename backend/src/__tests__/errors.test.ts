import { describe, it, expect } from 'vitest'
import { AppError } from '../utils/errors'

describe('AppError', () => {
  it('creates an error with status, message, and name', () => {
    const error = new AppError(400, 'Bad request')

    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(AppError)
    expect(error.name).toBe('AppError')
    expect(error.status).toBe(400)
    expect(error.message).toBe('Bad request')
  })

  it('accepts optional details', () => {
    const details = { field: 'email', code: 'INVALID' }
    const error = new AppError(422, 'Validation failed', details)

    expect(error.details).toEqual(details)
  })

  it('defaults details to undefined when not provided', () => {
    const error = new AppError(500, 'Server error')

    expect(error.details).toBeUndefined()
  })
})
