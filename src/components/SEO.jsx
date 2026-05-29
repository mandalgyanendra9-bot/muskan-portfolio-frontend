import { Helmet } from "react-helmet-async";

const SEO = ({ title, description, keywords, image }) => {
  const siteName = "Muskan Khatun Portfolio";
  const fullTitle = title ? `${title} | ${siteName}` : siteName;
  const metaDescription =
    description ||
    "Muskan Khatun's portfolio, expert consultations, live sessions, projects, and booking platform.";
  const metaKeywords =
    keywords ||
    "portfolio, expert consultations, live sessions, projects, react, nodejs, muskan khatun";

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={metaDescription} />
      <meta name="keywords" content={metaKeywords} />
      <meta name="robots" content="index,follow" />
      <meta name="theme-color" content="#0f172a" />
      <meta property="og:site_name" content={siteName} />
      
      {/* Open Graph / Facebook */}
      <meta property="og:type" content="website" />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={metaDescription} />
      {image && <meta property="og:image" content={image} />}

      {/* Twitter */}
      <meta property="twitter:card" content="summary_large_image" />
      <meta property="twitter:title" content={fullTitle} />
      <meta property="twitter:description" content={metaDescription} />
      {image && <meta property="twitter:image" content={image} />}
    </Helmet>
  );
};

export default SEO;
