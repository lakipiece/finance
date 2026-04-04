import PortfolioNav from '@/components/portfolio/PortfolioNav'

export default function PortfolioLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PortfolioNav />
      {children}
    </>
  )
}
