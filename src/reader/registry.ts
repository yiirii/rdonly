import { PagedComicMode } from './comic/PagedComicMode'
import { WebtoonMode } from './comic/WebtoonMode'
import { NovelMode } from './novel/NovelMode'
import { MODE_COMPONENTS } from './ReaderScreen'

// Each reading mode registers its component here as it is built.
export function registerModes() {
  MODE_COMPONENTS['paged-ltr'] = PagedComicMode
  MODE_COMPONENTS['paged-rtl'] = PagedComicMode
  MODE_COMPONENTS.webtoon = WebtoonMode
  MODE_COMPONENTS.novel = NovelMode
}
