import type { QuotationDraft } from "@/lib/quotation-content";

/* Complete sample quotations for the "Fill example" buttons: every field of the form, five services each,
   written in the house format (scope markup: "- " bullet, "-- " sub-point, "## " heading, "> " note). */

export type QuotationExample = { key: string; label: string; draft: QuotationDraft };

const STEPS_WEB = [
  { title: "Confirm Scope", text: "Approve this quotation in writing to lock the deliverables and fee." },
  { title: "Onboarding", text: "Share content, branding assets and domain/hosting preferences." },
  { title: "Go Live", text: "Development begins, followed by delivery within the agreed timeline." },
];

const CLOSING = "Thank you for the opportunity. We look forward to partnering with you.";

export const QUOTATION_EXAMPLES: QuotationExample[] = [
  {
    key: "clinic",
    label: "Doctor / clinic website",
    draft: {
      subject: "Website Development",
      subtitle: "Doctor / clinic website",
      client: {
        name: "Dr. Farhan Ahmad",
        company: "H.M. Surgical Hospital",
        email: "dr.farhan@hmsurgical.in",
        phone: "+91 98765 43210",
        address: "Civil Lines, Azamgarh, Uttar Pradesh 276001",
      },
      intro:
        "This quotation covers Website Development for Dr. Farhan Ahmad, designed to establish a professional online presence and generate appointment enquiries. The full scope of work, pricing and terms are detailed below.",
      services: [
        { tag: "DEV", title: "Website Development", points: "Design and development of a 7-page website\nMobile-first, fast-loading layout\nDelivery timeline: 10–15 Days", fee: 12000, note: "Timeline: 10–15 Days", taxRate: 0 },
        { tag: "HOST", title: "Domain & Hosting Charges", points: "Domain registration (.in)\nSSL-secured website hosting for 1 year", fee: 3000, note: "Valid for 1 year", taxRate: 0 },
        { tag: "SEO", title: "Local SEO Setup", points: "On-page SEO for all pages\nGoogle Business Profile optimisation\nTargeting Azamgarh searches", fee: 5000, note: "One-time setup", taxRate: 0 },
        { tag: "CONTENT", title: "Content Writing", points: "Copy for all pages and 8 treatment pages\n4 starter blog articles", fee: 4000, note: "", taxRate: 0 },
        { tag: "AMC", title: "Annual Maintenance", points: "Security updates and backups\nUp to 2 content changes a month", fee: 6000, note: "Per year", taxRate: 0 },
      ],
      scopeIntro:
        "Development of a modern, professional and conversion-focused website for Dr. Farhan Ahmad and the Orthopaedics Department of H.M. Surgical Hospital, designed to establish authority, present treatments clearly and generate appointment enquiries through a mobile-first experience.",
      scope: [
        {
          title: "Website Architecture",
          body: "The site will separate services, conditions and doctor information into a clear structure:\n- Home\n- About Dr. Farhan Ahmad\n- Orthopaedic Services\n-- Knee Replacement, ACL Surgery, Knee Arthroscopy, Fracture & Trauma Treatment, Hip Replacement\n- Conditions\n-- Knee Pain, Osteoarthritis, ACL Injury, Meniscus Tear, Shoulder Pain\n- Patient Reviews\n- Contact / Appointment",
        },
        {
          title: "Homepage Development",
          body: "The homepage will work as the primary patient-conversion landing page.\n## Hero Section\n- Doctor introduction with qualifications (DNB Ortho, Gold Medalist)\n- Primary CTA: Book an Appointment\n- Secondary CTA: Call Now / WhatsApp\n## Key Highlights\n- Joint Replacement\n- Arthroscopy & Sports Injury Care\n- H.M. Surgical Hospital, Azamgarh",
        },
        {
          title: "Appointment & Lead Generation",
          body: "- Appointment form: Name, Mobile Number, Preferred Date, Concern, Message\n- Sticky mobile CTA: Call | WhatsApp | Appointment\n- Enquiries delivered to email and WhatsApp\n> Every section ends with a clear call to action so visitors are never more than one tap from booking.",
        },
        {
          title: "SEO-Friendly Development",
          body: "## On-Page SEO\n- SEO-friendly URLs, meta titles & descriptions, proper H1–H6 hierarchy\n- Image ALT text, internal linking and schema markup\n## Local SEO\n- Focus on searches such as Orthopaedic Surgeon in Azamgarh and Knee Replacement in Azamgarh",
        },
        {
          title: "Technical Development Scope",
          body: "- Responsive development with an easy-to-edit CMS\n- WhatsApp, click-to-call and Google Maps integration\n- SSL, basic security hardening and daily backups\n- Performance and image optimisation",
        },
      ],
      steps: STEPS_WEB,
      terms:
        "Payment: 50% advance to start the work, balance on completion.\nDelivery Timeline: 10–15 Days from confirmation of scope and receipt of content.\nRevisions: Up to 2 rounds of design changes are included.\nTaxes: Prices are exclusive of GST.",
      closing: CLOSING,
    },
  },
  {
    key: "ecommerce",
    label: "E-commerce store",
    draft: {
      subject: "E-commerce Website",
      subtitle: "Online clothing store",
      client: {
        name: "Ayesha Khan",
        company: "Zara Ethnic Wear",
        email: "orders@zaraethnic.in",
        phone: "+91 99887 66554",
        address: "Aminabad Market, Lucknow, Uttar Pradesh 226018",
      },
      intro:
        "This quotation covers an E-commerce Website for Zara Ethnic Wear, designed to sell the full collection online with secure payments and simple order management. The full scope of work, pricing and terms are detailed below.",
      services: [
        { tag: "SHOP", title: "E-commerce Website Development", points: "Store with up to 200 products and categories\nCart, checkout and customer accounts\nDelivery timeline: 25–30 Days", fee: 35000, note: "Timeline: 25–30 Days", taxRate: 0 },
        { tag: "PAY", title: "Payment & Shipping Integration", points: "Razorpay / UPI / card payments and COD\nShiprocket integration with order tracking", fee: 8000, note: "", taxRate: 0 },
        { tag: "HOST", title: "Domain & Hosting Charges", points: "Domain registration (.in)\nE-commerce hosting with SSL for 1 year", fee: 6000, note: "Valid for 1 year", taxRate: 0 },
        { tag: "DESIGN", title: "Product Listing & Photo Editing", points: "Upload of the first 100 products\nBackground removal and image resizing", fee: 7000, note: "First 100 products", taxRate: 0 },
        { tag: "SEO", title: "SEO & Google Shopping Setup", points: "On-page SEO for categories and products\nGoogle Merchant Center product feed", fee: 9000, note: "One-time setup", taxRate: 0 },
      ],
      scopeIntro:
        "Development of a fast, mobile-first online store for Zara Ethnic Wear that showcases the collection beautifully, makes buying easy on any device, and gives the team simple tools to manage products, orders and stock.",
      scope: [
        {
          title: "Store Structure",
          body: "The store will be organised so customers find products in two taps:\n- Home\n- Shop by Category\n-- Kurtis, Suits, Sarees, Lehengas, Dupattas\n- New Arrivals & Offers\n- Product Pages\n- Cart & Checkout\n- My Account / Order Tracking\n- About, Contact, Policies",
        },
        {
          title: "Product & Order Management",
          body: "- Products with sizes, colours, stock and multiple images\n- Discount coupons, sale prices and combo offers\n- Order dashboard with status updates and invoices\n- Low-stock alerts by email",
        },
        {
          title: "Checkout & Payments",
          body: "The flow is kept short to reduce abandoned carts: Cart → Address → Payment → Confirmation.\n- UPI, cards, net banking and wallets via Razorpay\n- Cash on Delivery with pincode check\n- Order confirmation on email and WhatsApp",
        },
        {
          title: "Design & Mobile Experience",
          body: "- Premium, fashion-led design matching the Zara Ethnic Wear brand\n- Sticky add-to-cart and quick view on mobile\n- Fast-loading, compressed product images",
        },
        {
          title: "Launch & Training",
          body: "- Testing of payments, shipping and emails before launch\n- 1-hour training session for the store team\n- Written guide for adding products and processing orders\n> 30 days of free support after launch for any issues.",
        },
      ],
      steps: [
        { title: "Confirm Scope", text: "Approve this quotation in writing to lock the deliverables and fee." },
        { title: "Onboarding", text: "Share product photos, prices, logo and payment gateway details." },
        { title: "Go Live", text: "The store is built, tested and launched within 25–30 days." },
      ],
      terms:
        "Payment: 40% advance, 40% on design approval, 20% before launch.\nDelivery Timeline: 25–30 Days from receipt of product data.\nPayment Gateway: Gateway charges are paid by the client directly to the provider.\nTaxes: Prices are exclusive of GST.",
      closing: CLOSING,
    },
  },
  {
    key: "marketing",
    label: "Restaurant digital marketing",
    draft: {
      subject: "Digital Marketing",
      subtitle: "Monthly social media & ads",
      client: {
        name: "Rohit Mehra",
        company: "Spice Route Restaurant",
        email: "rohit@spiceroute.in",
        phone: "+91 91234 56789",
        address: "Hazratganj, Lucknow, Uttar Pradesh 226001",
      },
      intro:
        "This quotation covers Digital Marketing for Spice Route Restaurant, designed to grow footfall, online orders and table bookings through social media, ads and local search. The full scope of work, pricing and terms are detailed below.",
      services: [
        { tag: "SMM", title: "Social Media Management", points: "Instagram and Facebook management\n16 posts and 8 reels a month\nCaptions, hashtags and community replies", fee: 15000, note: "Per month", taxRate: 0 },
        { tag: "ADS", title: "Meta & Google Ads Management", points: "Campaign setup, targeting and optimisation\nMonthly performance report", fee: 8000, note: "Per month, ad budget extra", taxRate: 0 },
        { tag: "SHOOT", title: "Food Photography & Reels Shoot", points: "One shoot a month at the restaurant\n25 edited photos and 4 reel videos", fee: 10000, note: "Per month", taxRate: 0 },
        { tag: "SEO", title: "Google Business Profile Optimisation", points: "Profile setup, photos and menu\nWeekly posts and review responses", fee: 4000, note: "Per month", taxRate: 0 },
        { tag: "BRAND", title: "Festive Campaign Creatives", points: "Designs for Diwali, Eid, Christmas and New Year\nIn-store posters and menu inserts", fee: 6000, note: "One-time", taxRate: 0 },
      ],
      scopeIntro:
        "A complete monthly marketing programme for Spice Route Restaurant that builds a strong local brand, keeps the restaurant top-of-mind on social media, and turns online attention into table bookings and delivery orders.",
      scope: [
        {
          title: "Social Media Strategy",
          body: "Each month starts with a content calendar approved by the restaurant:\n- Signature dishes, chef stories and behind-the-scenes\n- Offers, combos and weekend specials\n- Customer reviews and user-generated content\n- Trending reels adapted to the Spice Route brand",
        },
        {
          title: "Paid Advertising",
          body: "## Meta Ads\n- Local audience within 5 km of Hazratganj\n- Offer and table-booking campaigns\n## Google Ads\n- Searches such as Best Restaurant in Hazratganj\n> Recommended ad budget: Rs. 10,000–15,000 a month, paid directly to Meta / Google.",
        },
        {
          title: "Content Production",
          body: "- Monthly on-site shoot of dishes, interiors and staff\n- Professional editing, colour grading and music for reels\n- Story templates for daily specials",
        },
        {
          title: "Local Search & Reviews",
          body: "- Google Business Profile kept complete and active\n- Replies to every review within 48 hours\n- Review request QR code for tables and bills",
        },
        {
          title: "Reporting",
          body: "- Monthly report: reach, followers, engagement, ad results and bookings\n- 30-minute review call to plan the next month",
        },
      ],
      steps: [
        { title: "Confirm Plan", text: "Approve this quotation to lock the monthly plan and fee." },
        { title: "Kick-off", text: "Share page access, menu, offers and brand assets." },
        { title: "Launch", text: "The first content calendar and campaigns go live within 7 days." },
      ],
      terms:
        "Payment: Monthly fee payable in advance by the 5th of each month.\nMinimum Term: 3 months, then month-to-month.\nAd Budget: Paid by the client directly to Meta / Google.\nTaxes: Prices are exclusive of GST.",
      closing: CLOSING,
    },
  },
];
