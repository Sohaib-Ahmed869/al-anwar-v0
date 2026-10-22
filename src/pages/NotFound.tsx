import { Link } from 'react-router-dom'
import { BrandMark, GradientDomes } from '../components/Brand'
import { ArrowRight } from '../components/icons'

/* A wrong turn, met with the brand rather than an apology in plain type: the
   mark, a two-tone heading in the guide's manner, and the six gradient domes
   of p. 15 standing under it. */
export default function NotFound() {
  return (
    <div className="gutter mx-auto flex max-w-page flex-col items-center py-[clamp(64px,10vw,140px)] text-center">
      <BrandMark className="h-16 w-auto" />
      <p className="mt-s3 font-script text-teal">Error 404</p>
      <h1 className="mt-s2 font-display text-[clamp(36px,5vw,64px)] leading-[1.02]">
        This door is <span className="text-teal-mid">closed.</span>
      </h1>
      <p className="mt-s2 max-w-[44ch] text-[16px] leading-relaxed text-text-2">
        The page you were looking for isn't here. Every other door on the site is open.
      </p>
      <Link
        to="/"
        className="group mt-s4 inline-flex min-h-[50px] items-center gap-2 rounded-[12px] bg-teal px-6 text-[15.5px] font-semibold text-paper transition-colors duration-200 hover:bg-ink"
      >
        Back to the home page
        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </Link>
      <GradientDomes className="mt-[clamp(48px,6vw,80px)]" domeClass="w-[clamp(40px,5vw,70px)]" />
    </div>
  )
}
