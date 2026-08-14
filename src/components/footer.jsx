
function Footer() {
  return (
    <footer className="mt-10 pb-10 text-center">
      <div className="rule mb-4" />
      <div className="flex items-center justify-center gap-3 text-xs text-neutral-500">
        <a
          href="https://bastiangruber.ca"
          target="_blank"
          rel="noreferrer"
          className="text-neutral-500 hover:text-neutral-300 no-underline"
        >
          Made with ♥ by Bastian
        </a>
        <span aria-hidden>·</span>
        <a
          href="https://open-meteo.com/"
          target="_blank"
          rel="noreferrer"
          className="text-neutral-500 hover:text-neutral-300 no-underline"
        >
          Weather data by Open-Meteo
        </a>
      </div>
    </footer>
  );
}

export default Footer;
