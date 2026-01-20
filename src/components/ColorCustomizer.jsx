import React, { useState } from 'react'
import './ColorCustomizer.css'

const COLOR_OPTIONS = [
  { name: 'Black', value: '#000000' },
  { name: 'Dark Red', value: '#520d0d' },
  { name: 'Light Blue', value: '#018de2' },
  { name: 'Dark Grey', value: '#2E2D30' },
  { name: 'Red Brown', value: '#a84243' },
  { name: 'Brown', value: '#9b553c' },
  { name: 'Orange Yellow', value: '#fda714' },
  { name: 'Dark Green', value: '#08521f' },
  { name: 'Brown Red', value: '#7e4734' },
  { name: 'Deep Red', value: '#59171f' },
  { name: 'Navy Blue', value: '#0b2e63' },
  { name: 'Red', value: '#fe3f2c' },
  { name: 'Pink', value: '#e47794' },
  { name: 'Purple', value: '#803275' },
  { name: 'Bright Red', value: '#e62525' },
  { name: 'Medium Blue', value: '#0160ba' },
  { name: 'Coral Red', value: '#b74936' },
  { name: 'Grey', value: '#9e9e9e' },
  { name: 'Teal Blue', value: '#01526f' },
  { name: 'Light Pink', value: '#f7e1e1' },
]

const LOGO_OPTIONS = [
  { name: 'Logo 1', value: '/img/logo/logo.png' },
  { name: 'Logo 2', value: '/img/logo/logo.png' },
  { name: 'Logo 3', value: '/img/logo/logo.png' },
  { name: 'Logo 4', value: '/img/logo/logo.png' },
  { name: 'Logo 5', value: '/img/logo/logo.png' },
  { name: 'Logo 6', value: '/img/logo/logo.png' },
  { name: 'Logo 7', value: '/img/logo/logo.png' },
  { name: 'Logo 8', value: '/img/logo/logo.png' },
  { name: 'Logo 9', value: '/img/logo/logo.png' },
  { name: 'Logo 10', value: '/img/logo/logo.png' },
  { name: 'Logo 11', value: '/img/logo/logo.png' },
  { name: 'Logo 12', value: '/img/logo/logo.png' },
  { name: 'Logo 13', value: '/img/logo/logo.png' },
  { name: 'Logo 14', value: '/img/logo/logo.png' },
  { name: 'Logo 15', value: '/img/logo/logo.png' },
  { name: 'Logo 16', value: '/img/logo/logo.png' },
]

const ColorCustomizer = ({
  handleColor,
  barrelColor,
  onHandleColorChange,
  onBarrelColorChange }) => {
  const [selectedLogo, setSelectedLogo] = useState(null)
  const [length, setLength] = useState('32')
  const [weight, setWeight] = useState('')
  const [batFinish, setBatFinish] = useState('')
  const [woodSpecies, setWoodSpecies] = useState('')
  const [xtraProcessing, setXtraProcessing] = useState('')
  const [axeHandle, setAxeHandle] = useState('')
  const [topreed, setTopreed] = useState('')
  const [batRushProduction, setBatRushProduction] = useState('')
  const [customCupping, setCustomCupping] = useState('')
  const [additionalNotes, setAdditionalNotes] = useState('')

  const handleAddToCart = () => {
    console.log('Add to cart:', {
      handleColor,
      barrelColor,
      selectedLogo,
      length,
      weight,
      batFinish,
      woodSpecies,
      xtraProcessing,
      axeHandle,
      topreed,
      batRushProduction,
      customCupping,
      additionalNotes,
    })
  }

  return (
    <div className="color-customizer">
      <h2 className="customizer-title">CUSTOMIZE YOUR BAT</h2>

      <div className="customization-sections-container">
        <div className="customization-section">
          <h3 className="section-title">HANDLE FINISH</h3>
          <div className="color-grid">
            {COLOR_OPTIONS.map((color) => (
              <button
                key={color.value}
                className={`color-swatch ${handleColor === color.value ? 'selected' : ''}`}
                style={{ backgroundColor: color.value }}
                onClick={() => onHandleColorChange(color.value)}
                aria-label={`Select ${color.name} for handle`}
              />
            ))}
          </div>
        </div>

        <div className="customization-section">
          <h3 className="section-title">BARREL FINISH</h3>
          <div className="color-grid">
            {COLOR_OPTIONS.map((color) => (
              <button
                key={color.value}
                className={`color-swatch ${barrelColor === color.value ? 'selected' : ''}`}
                style={{ backgroundColor: color.value }}
                onClick={() => onBarrelColorChange(color.value)}
                aria-label={`Select ${color.name} for barrel`}
              />
            ))}
          </div>
        </div>

        <div className="customization-section logo-section">
          <h3 className="section-title">LOGO</h3>
          <div className="logo-grid">
            {LOGO_OPTIONS.map((logo, index) => (
              <button
                key={index}
                className={`logo-swatch ${selectedLogo === logo.value ? 'selected' : ''}`}
                onClick={() => setSelectedLogo(logo.value)}
                aria-label={`Select ${logo.name}`}
              >
                <img src={logo.value} alt={logo.name} />
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="form-sections-container">
        <div className="form-row">
          <div className="form-field">
            <label className="field-label">LENGTH (IN)</label>
            <select
              className="form-select"
              value={length}
              onChange={(e) => setLength(e.target.value)}
            >
              <option value="30">30 in</option>
              <option value="31">31 in</option>
              <option value="32">32 in</option>
              <option value="33">33 in</option>
              <option value="34">34 in</option>
            </select>
          </div>

          <div className="form-field">
            <label className="field-label">WEIGHT (OZ)</label>
            <select
              className="form-select"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
            >
              <option value="">Select...</option>
              <option value="28">28 oz</option>
              <option value="29">29 oz</option>
              <option value="30">30 oz</option>
              <option value="31">31 oz</option>
              <option value="32">32 oz</option>
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-field">
            <label className="field-label">BAT FINISH</label>
            <p className="field-description">
              Choose between gloss and matte finishes. Gloss provides a shiny, professional look while matte offers a more subdued appearance.
            </p>
            <select
              className="form-select"
              value={batFinish}
              onChange={(e) => setBatFinish(e.target.value)}
            >
              <option value="">Select...</option>
              <option value="gloss">Gloss</option>
              <option value="matte">Matte</option>
            </select>
          </div>

          <div className="form-field">
            <label className="field-label">WOOD SPECIES</label>
            <p className="field-description">
              Hard Maple is the most popular wood bat type. It has a tight grain structure and is known for its durability and performance.
            </p>
            <select
              className="form-select"
              value={woodSpecies}
              onChange={(e) => setWoodSpecies(e.target.value)}
            >
              <option value="">Select...</option>
              <option value="hard-maple">Hard Maple</option>
              <option value="ash">Ash</option>
              <option value="birch">Birch</option>
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-field">
            <label className="field-label">XTRA PROCESSING</label>
            <p className="field-description">
              Xtra Processing (XP) finish requires additional curing time and provides enhanced hardness and durability.
            </p>
            <select
              className="form-select"
              value={xtraProcessing}
              onChange={(e) => setXtraProcessing(e.target.value)}
            >
              <option value="">Select...</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>

          <div className="form-field">
            <label className="field-label">AXE HANDLE</label>
            <p className="field-description">
              Add our patented Axe Handle for a unique feel and improved grip control.
            </p>
            <select
              className="form-select"
              value={axeHandle}
              onChange={(e) => setAxeHandle(e.target.value)}
            >
              <option value="">Select...</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-field">
            <label className="field-label">TOPREED</label>
            <select
              className="form-select"
              value={topreed}
              onChange={(e) => setTopreed(e.target.value)}
            >
              <option value="">Select...</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>

          <div className="form-field">
            <label className="field-label">BAT RUSH PRODUCTION</label>
            <p className="field-description">
              Once your order is completed, your bat will be placed in the same high priority lane as our pro athlete orders.
            </p>

            <select
              className="form-select"
              value={batRushProduction}
              onChange={(e) => setBatRushProduction(e.target.value)}
            >
              <option value="">Select...</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-field full-width">
            <label className="field-label">CUSTOM CUPPING</label>
            <p className="field-description">
              Cupping is designed to take weight off the end of the bat to add a more balanced feel - while keeping to the chosen weight. Available in No Cup, Kiss Cup (smallest), Half Cup and Cup (largest).
            </p>
            <select
              className="form-select"
              value={customCupping}
              onChange={(e) => setCustomCupping(e.target.value)}
            >
              <option value="">Select...</option>
              <option value="no-cup">No Cup</option>
              <option value="kiss-cup">Kiss Cup (Smallest)</option>
              <option value="half-cup">Half Cup</option>
              <option value="cup">Cup (Largest)</option>
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-field full-width">
            <label className="field-label">ADDITIONAL NOTES</label>
            <textarea
              className="form-textarea"
              value={additionalNotes}
              onChange={(e) => setAdditionalNotes(e.target.value)}
              placeholder="Add any additional notes or special requests..."
              rows={4}
            />
          </div>
        </div>

        <div className="form-row">
          <button className="add-to-cart-button" onClick={handleAddToCart}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="9" cy="21" r="1"></circle>
              <circle cx="20" cy="21" r="1"></circle>
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
            </svg>
            ADD TO CART
          </button>
        </div>
      </div>
    </div>
  )
}

export default ColorCustomizer
