import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import PromiseBanner from "@/components/PromiseBanner";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Nav />
      <PromiseBanner />
      <main>{children}</main>
      <Footer />
    </>
  );
}
