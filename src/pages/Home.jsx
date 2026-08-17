import FurfooScrollHero from '../components/FurfooScrollHero'
import OurStory from '../components/OurStory'
import ProductCategories from '../components/ProductCategories'
import FeaturedProducts from '../components/FeaturedProducts'
import Adoption from '../components/Adoption'
import Reviews from '../components/Reviews'
import FAQ from '../components/FAQ'
import Footer from '../components/Footer'

export default function Home() {
  return <>
    <main className="home-page">
      <FurfooScrollHero/>
      <OurStory/>
      <ProductCategories/>
      <FeaturedProducts/>
      <Reviews/>
      <Adoption/>
      <FAQ/>
    </main>
    <Footer/>
  </>
}
