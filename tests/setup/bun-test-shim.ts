import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  test,
  vi,
} from 'vitest'

const mockedModules = new Set<string>()

export const mock = {
  module(id: string, factory: () => unknown) {
    mockedModules.add(id)
    vi.doMock(id, factory as never)
  },
  restore() {
    for (const id of mockedModules) {
      vi.doUnmock(id)
    }
    mockedModules.clear()
    vi.resetModules()
    vi.restoreAllMocks()
  },
}

export {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  test,
}
