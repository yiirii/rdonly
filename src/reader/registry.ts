import { PagedComicMode } from './comic/PagedComicMode'
import { MODE_COMPONENTS } from './ReaderScreen'

// Each reading mode registers its component here as it is built.
export function registerModes() {
  MODE_COMPONENTS['paged-ltr'] = PagedComicMode
  MODE_COMPONENTS['paged-rtl'] = PagedComicMode
}
