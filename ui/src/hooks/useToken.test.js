import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import useToken from './useToken'

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

describe('useToken', () => {
  it('legt das Token mit Haekchen dauerhaft ab', () => {
    const { result } = renderHook(() => useToken())

    act(() => result.current.setToken('abc', true))

    expect(localStorage.getItem('jwtToken')).toBe('abc')
    expect(sessionStorage.getItem('jwtToken')).toBeNull()
    expect(result.current.token).toBe('abc')
  })

  it('legt das Token ohne Haekchen nur fuer die Sitzung ab', () => {
    const { result } = renderHook(() => useToken())

    act(() => result.current.setToken('abc', false))

    expect(sessionStorage.getItem('jwtToken')).toBe('abc')
    expect(localStorage.getItem('jwtToken')).toBeNull()
  })

  it('erneuert im dauerhaften Speicher, wenn das Token dort liegt', () => {
    const { result } = renderHook(() => useToken())
    act(() => result.current.setToken('alt', true))

    act(() => result.current.erneuereToken('neu'))

    expect(localStorage.getItem('jwtToken')).toBe('neu')
    expect(result.current.token).toBe('neu')
  })

  it('erneuert eine Sitzung nicht zu einer dauerhaften Anmeldung', () => {
    // Der eigentliche Punkt dieses Tests: wer "Angemeldet bleiben" nicht
    // angekreuzt hat, darf durch die Verlaengerung nicht in localStorage
    // wandern - sonst waere die Sitzung nach dem Schliessen des Browsers doch
    // noch da.
    const { result } = renderHook(() => useToken())
    act(() => result.current.setToken('alt', false))

    act(() => result.current.erneuereToken('neu'))

    expect(sessionStorage.getItem('jwtToken')).toBe('neu')
    expect(localStorage.getItem('jwtToken')).toBeNull()
  })

  it('belebt eine abgemeldete Sitzung nicht wieder', () => {
    // Eine Anfrage kann noch unterwegs sein, wenn abgemeldet wird. Ihre
    // Antwort darf das Token nicht zurueckschreiben.
    const { result } = renderHook(() => useToken())
    act(() => result.current.setToken('alt', true))
    act(() => result.current.removeToken())

    act(() => result.current.erneuereToken('neu'))

    expect(localStorage.getItem('jwtToken')).toBeNull()
    expect(sessionStorage.getItem('jwtToken')).toBeNull()
    expect(result.current.token).toBeNull()
  })
})
