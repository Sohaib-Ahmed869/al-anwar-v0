import { Navigate } from 'react-router-dom'

/* The calculator is a section of the Zakat page now (sections/ZakatCalc.tsx).
   This route stays so every link and bookmark to it still lands on it. */
export default function ZakatCalculator() {
  return <Navigate to="/zakat#calculator" replace />
}
