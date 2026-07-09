import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="dp-footer">
      <div className="footer-main">
        <p className="footer-age">Solo mayores de 18 años</p>
        <p className="footer-legal">Accesorios de uso personal · No incluye sustancias</p>
        <p className="footer-address">Distrito Pipa · Cancún</p>
      </div>
      
      <div className="footer-agency">
        <span>Powered by</span>
        <span className="agency-link">
          Jonla Agencia
        </span>
      </div>
    </footer>
  )
}
