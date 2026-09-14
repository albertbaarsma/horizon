import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const mockGetUser = vi.fn()
const mockSelectResult = vi.fn()
const mockInsert = vi.fn()
const mockDelete = vi.fn()
const mockUpload = vi.fn()
const mockRemove = vi.fn()
const mockCreateSignedUrls = vi.fn()
const mockCreateSignedUrl = vi.fn()

vi.mock('@/lib/supabase', () => ({
  createClient: () => ({
    auth: { getUser: () => mockGetUser() },
    from: () => ({
      select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ order: () => mockSelectResult() }) }) }) }),
      insert: (row: unknown) => { mockInsert(row); return Promise.resolve({ error: null }) },
      delete: () => ({ eq: () => { mockDelete(); return Promise.resolve({ error: null }) } }),
    }),
    storage: {
      from: () => ({
        upload: (...args: unknown[]) => mockUpload(...args),
        remove: (...args: unknown[]) => mockRemove(...args),
        createSignedUrls: (...args: unknown[]) => mockCreateSignedUrls(...args),
        createSignedUrl: (...args: unknown[]) => mockCreateSignedUrl(...args),
      }),
    },
  }),
}))

const { Attachments } = await import('@/app/dashboard/Attachments')

beforeEach(() => {
  vi.clearAllMocks()
  mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
  mockSelectResult.mockResolvedValue({ data: [] })
  mockUpload.mockResolvedValue({ error: null })
  mockCreateSignedUrls.mockResolvedValue({ data: [] })
  mockCreateSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://signed/file' } })
})

function makeFile(name: string, type: string, size: number): File {
  const f = new File(['x'], name, { type })
  Object.defineProperty(f, 'size', { value: size })
  return f
}

describe('Attachments — lijst', () => {
  it('toont "Nog geen bijlagen" als de lijst leeg is', async () => {
    render(<Attachments entityType="project" entityId="p1" />)
    await screen.findByText('Nog geen bijlagen.')
  })

  it('toont een afbeelding als thumbnail en een ander bestand met bestandsnaam', async () => {
    mockSelectResult.mockResolvedValue({
      data: [
        { id: 1, user_id: 'u1', entity_type: 'project', entity_id: 'p1', file_name: 'foto.jpg', storage_path: 'u1/project/p1/1-foto.jpg', mime_type: 'image/jpeg', size_bytes: 2048, created_at: '' },
        { id: 2, user_id: 'u1', entity_type: 'project', entity_id: 'p1', file_name: 'plan.pdf', storage_path: 'u1/project/p1/2-plan.pdf', mime_type: 'application/pdf', size_bytes: 5000, created_at: '' },
      ],
    })
    mockCreateSignedUrls.mockResolvedValue({ data: [{ signedUrl: 'https://signed/foto.jpg' }] })
    render(<Attachments entityType="project" entityId="p1" />)
    const img = await screen.findByAltText('foto.jpg')
    expect(img).toHaveAttribute('src', 'https://signed/foto.jpg')
    expect(screen.getByText('plan.pdf')).toBeTruthy()
  })

  it('vraagt alleen signed urls op voor afbeeldingen, niet voor andere bestanden', async () => {
    mockSelectResult.mockResolvedValue({
      data: [{ id: 2, user_id: 'u1', entity_type: 'project', entity_id: 'p1', file_name: 'plan.pdf', storage_path: 'u1/project/p1/2-plan.pdf', mime_type: 'application/pdf', size_bytes: 5000, created_at: '' }],
    })
    render(<Attachments entityType="project" entityId="p1" />)
    await screen.findByText('plan.pdf')
    expect(mockCreateSignedUrls).not.toHaveBeenCalled()
  })
})

describe('Attachments — uploaden', () => {
  it('uploadt een gekozen bestand naar storage en registreert het in de tabel', async () => {
    render(<Attachments entityType="task" entityId="7" />)
    await waitFor(() => expect(mockSelectResult).toHaveBeenCalled())
    const input = screen.getByLabelText('Bestand kiezen') as HTMLInputElement
    fireEvent.change(input, { target: { files: [makeFile('foto.jpg', 'image/jpeg', 1000)] } })
    await waitFor(() => expect(mockUpload).toHaveBeenCalled())
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'u1', entity_type: 'task', entity_id: '7', file_name: 'foto.jpg', mime_type: 'image/jpeg', size_bytes: 1000,
    }))
  })

  it('weigert een bestand groter dan 15MB, zonder te uploaden', async () => {
    render(<Attachments entityType="project" entityId="p1" />)
    await waitFor(() => expect(mockSelectResult).toHaveBeenCalled())
    const input = screen.getByLabelText('Bestand kiezen') as HTMLInputElement
    fireEvent.change(input, { target: { files: [makeFile('groot.pdf', 'application/pdf', 20 * 1024 * 1024)] } })
    await screen.findByText(/groter dan 15MB/)
    expect(mockUpload).not.toHaveBeenCalled()
    expect(mockInsert).not.toHaveBeenCalled()
  })
})

describe('Attachments — verwijderen', () => {
  it('verwijdert het bestand uit storage en de tabel, en haalt het uit beeld', async () => {
    mockSelectResult.mockResolvedValue({
      data: [{ id: 1, user_id: 'u1', entity_type: 'project', entity_id: 'p1', file_name: 'notitie.pdf', storage_path: 'u1/project/p1/1-notitie.pdf', mime_type: 'application/pdf', size_bytes: 1000, created_at: '' }],
    })
    render(<Attachments entityType="project" entityId="p1" />)
    const del = await screen.findByLabelText('notitie.pdf verwijderen')
    fireEvent.click(del)
    await waitFor(() => expect(mockRemove).toHaveBeenCalledWith(['u1/project/p1/1-notitie.pdf']))
    expect(mockDelete).toHaveBeenCalled()
    expect(screen.queryByText('notitie.pdf')).not.toBeInTheDocument()
  })
})

describe('Attachments — zonder ingelogde gebruiker', () => {
  it('crasht niet en toont gewoon de lege staat', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    render(<Attachments entityType="project" entityId="p1" />)
    await screen.findByText('Nog geen bijlagen.')
  })
})
