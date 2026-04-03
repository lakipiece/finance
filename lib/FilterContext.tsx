'use client'

import { createContext, useContext, useState, useEffect } from 'react'

interface FilterCtx {
  excludeLoan: boolean
  setExcludeLoan: (v: boolean) => void
}

const FilterContext = createContext<FilterCtx>({
  excludeLoan: false,
  setExcludeLoan: () => {},
})

export function FilterProvider({ children }: { children: React.ReactNode }) {
  const [excludeLoan, setExcludeLoanState] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('exclude-loan')
    if (saved === 'true') setExcludeLoanState(true)
  }, [])

  function setExcludeLoan(v: boolean) {
    setExcludeLoanState(v)
    localStorage.setItem('exclude-loan', String(v))
  }

  return (
    <FilterContext.Provider value={{ excludeLoan, setExcludeLoan }}>
      {children}
    </FilterContext.Provider>
  )
}

export function useFilter() {
  return useContext(FilterContext)
}
