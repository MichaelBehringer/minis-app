import { render, screen } from '@testing-library/react'
import dayjs from 'dayjs'
import { describe, expect, it } from 'vitest'
import AppProviders from './AppProviders'

describe('AppProviders', () => {
  it('macht dayjs mit Formatangabe brauchbar', () => {
    // Ohne das customParseFormat-Plugin ignoriert dayjs das zweite Argument
    // und liefert Invalid Date. Genau das stand im Detail-Dialog der
    // Startseite: "Invalid Date Uhr".
    render(<AppProviders>ok</AppProviders>)

    expect(dayjs('18:30:00', 'HH:mm:ss').format('HH:mm')).toBe('18:30')
  })

  it('stellt dayjs auf Deutsch', () => {
    render(<AppProviders>ok</AppProviders>)

    expect(dayjs('2026-08-23').format('dddd')).toBe('Sonntag')
  })

  it('rendert seine Kinder', () => {
    render(<AppProviders><span>Inhalt</span></AppProviders>)

    expect(screen.getByText('Inhalt')).toBeInTheDocument()
  })
})
