import GalleryHero from '../sections/GalleryHero'
import GalleryAlbum from '../sections/GalleryAlbum'
import GallerySend from '../sections/GallerySend'

/* ---------------------------------------------------------------------------
   Gallery, in three parts. A table of contents, like every page. The
   photographs and every word are in components/gallery-data.ts.

   Added 17 September 2026 at the user's request (the sitemap lists Gallery).
   ONLY THE CHARITY'S OWN PHOTOGRAPHS go on this page: read the head of
   gallery-data.ts before adding one.

   1. The hero ....... GalleryHero   teal, the words and three captioned frames
   2. The album ...... GalleryAlbum  #album. Place filter, years, a viewer
   3. The close ...... GallerySend   teal panel: send us your photographs
--------------------------------------------------------------------------- */
export default function Gallery() {
  return (
    <>
      <GalleryHero />
      <GalleryAlbum />
      <GallerySend />
    </>
  )
}
