import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="gutter mx-auto max-w-page py-s5">
      <h1 className="font-display text-4xl">Page not found</h1>
      <p className="mt-s2 text-text-2">
        That page isn't here. <Link to="/" className="text-green underline">Back to the home page</Link>
      </p>
    </div>
  )
}
