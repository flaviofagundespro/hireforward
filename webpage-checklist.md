# Checklist — Renovação de Webpage

> Usar em cada página nova ou renovada. Marque os itens com `[x]` conforme for implementando.

---

## ⚙ Head & Meta essencial

- [ ] **Favicon** — favicon.ico + apple-touch-icon.png + manifest (para Android)
- [ ] **`<title>` único por página** — 50–60 chars, palavra-chave principal no início
- [ ] **Meta description** — 150–160 chars, inclui CTA, único por página
- [ ] **Viewport tag** — `<meta name="viewport" content="width=device-width, initial-scale=1">`
- [ ] **Canonical URL** — `<link rel=canonical>` em toda página para evitar conteúdo duplicado
- [ ] **Atributo `lang` no `<html>`** — `html lang="pt-BR"` — sinal de localização para o Google
- [ ] **Charset UTF-8** — `<meta charset="UTF-8">` — evita problemas com acentos
- [ ] **Open Graph / Twitter Cards** — og:title, og:description, og:image (1200x630px), og:url

---

## 🔍 SEO on-page

- [ ] **H1 único** — apenas um por página, contém palavra-chave principal
- [ ] **Estrutura H2/H3 lógica** — hierarquia clara de títulos, facilita leitura pelos bots
- [ ] **Alt em todas as imagens** — descritivo e relevante, nunca em branco para imagens de conteúdo
- [ ] **Schema.org (dados estruturados)** — Article, FAQ, BreadcrumbList, Organization — melhora rich snippets
- [ ] **Sitemap XML** — /sitemap.xml gerado e enviado no Google Search Console
- [ ] **robots.txt** — permite rastreamento correto, bloqueia /admin/ etc.
- [ ] **Core Web Vitals** — LCP < 2.5s, CLS < 0.1, FID/INP < 200ms — checar no PageSpeed Insights
- [ ] **Design responsivo** — testar em mobile real ou DevTools 375px

---

## 📄 Conteúdo que o Google ama

- [ ] **Seção FAQ** — mínimo 5 perguntas, marcadas com Schema FAQ — aparece em featured snippets
- [ ] **Breadcrumb (trilha de navegação)** — mostra hierarquia da página, marcado com Schema Breadcrumb
- [ ] **Índice / Sumário** — para artigos longos — links âncora para cada seção H2
- [ ] **Data de atualização visível** — `<time>` com dateModified — Google prefere conteúdo atualizado
- [ ] **Autoria / About the author** — nome, bio curta, links — sinal de E-E-A-T (expertise)
- [ ] **Links internos relevantes** — 3–5 links para outras páginas do site por artigo

---

## 📋 Páginas obrigatórias do site

- [ ] **Política de Privacidade** — /politica-de-privacidade — exigida por lei (LGPD/GDPR) e pelo Google AdSense
- [ ] **Termos de Uso** — /termos-de-uso — protege legalmente e melhora confiança
- [ ] **Sobre / About** — /sobre — crucial para E-E-A-T, descreve quem está por trás do site
- [ ] **Contato** — /contato — formulário ou email visível — sinal de confiança
- [ ] **Página 404 personalizada** — com links para home e busca — reduz bounce rate em erros

---

## 📊 Analytics & Search Console

- [ ] **Google Analytics 4 (GA4)** — tag instalada e verificada — confirmar eventos de página view
- [ ] **Google Search Console** — site verificado e sitemap enviado
- [ ] **Google Tag Manager** *(opcional)* — facilita adicionar pixels/tags sem mexer no código

---

## 🔗 Rodapé

- [ ] **Links: Privacidade, Termos, Contato, Sobre** — mínimo de links legais e de navegação
- [ ] **Copyright com ano atual** — © 2025 Nome do Site — atualizar todo ano ou via JS
- [ ] **Links para redes sociais** — com `rel="noopener noreferrer"`
- [ ] **Schema Organization no rodapé** — nome, logo, URL, contato — uma vez por site

---

*Template HTML completo com tudo já implementado: `webpage-skeleton.html`*
