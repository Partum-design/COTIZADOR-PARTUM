import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowDown,
  ArrowUp,
  Bot,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  CircleDollarSign,
  Copy,
  Download,
  FileText,
  ImagePlus,
  LoaderCircle,
  Mic,
  MicOff,
  Minus,
  Plus,
  ReceiptText,
  RotateCcw,
  Save,
  Settings2,
  Sparkles,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import "./styles.css";

const STORAGE_KEY = "partum-cotizador-v1";

const initialQuote = {
  issuer: "PARTUM Design",
  issuerSubtitle: "Diseño, estrategia y soluciones digitales",
  client: "",
  contact: "",
  folio: `PAR-${new Date().getFullYear()}-${String(
    Math.floor(Math.random() * 900) + 100,
  )}`,
  date: new Date().toISOString().slice(0, 10),
  validDays: 30,
  currency: "MXN",
  taxRate: 16,
  discount: 0,
  notes:
    "El proyecto se programa al confirmar la propuesta. Servicios o entregables adicionales se cotizan por separado.",
  paymentTerms: "50% de anticipo y 50% contra entrega.",
  logo: "",
  items: [],
};

const money = (value, currency = "MXN") =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);

const displayDate = (date) => {
  if (!date) return "—";
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
};

const clampNumber = (value, min = 0) =>
  Math.max(min, Number.isFinite(Number(value)) ? Number(value) : 0);

function BrandMark({ dark = false, compact = false }) {
  const source = dark
    ? "/LOGO%20PARA%20FONDOS%20CLAROS.png"
    : compact
      ? "/LOGOTIPO%20BLANCO.png"
      : "/partum-logo-dark.png";

  return (
    <div className={`brand ${dark ? "brand--paper" : ""} ${compact ? "brand--compact" : ""}`}>
      <img
        className="brand__official"
        src={source}
        alt="PARTUM Design"
      />
    </div>
  );
}

function Field({ label, icon: Icon, hint, className = "", ...props }) {
  return (
    <label className={`field ${className}`}>
      <span className="field__label">
        {Icon && <Icon size={13} strokeWidth={2} />}
        {label}
      </span>
      <input {...props} />
      {hint && <small>{hint}</small>}
    </label>
  );
}

function SelectField({ label, icon: Icon, children, ...props }) {
  return (
    <label className="field">
      <span className="field__label">
        {Icon && <Icon size={13} strokeWidth={2} />}
        {label}
      </span>
      <span className="select-wrap">
        <select {...props}>{children}</select>
        <ChevronDown size={14} aria-hidden="true" />
      </span>
    </label>
  );
}

function Section({ icon: Icon, title, summary, open, onToggle, children }) {
  return (
    <section className={`editor-section ${open ? "is-open" : ""}`}>
      <button
        className="section-heading"
        onClick={onToggle}
        type="button"
        aria-expanded={open}
      >
        <span className="section-heading__icon">
          <Icon size={17} />
        </span>
        <span>
          <strong>{title}</strong>
          <small>{summary}</small>
        </span>
        <ChevronDown className="section-heading__chevron" size={17} />
      </button>
      {open && <div className="section-body">{children}</div>}
    </section>
  );
}

function Toast({ message }) {
  if (!message) return null;
  return (
    <div className="toast" role="status">
      <Check size={15} />
      {message}
    </div>
  );
}

function EmptyItems({ onAdd }) {
  return (
    <div className="empty-items">
      <span className="empty-items__brand">
        <img
          src="/favicon-cropped.png"
          alt=""
        />
      </span>
      <strong>Tu propuesta aún está vacía</strong>
      <p>Agrega el primer servicio para comenzar a calcularla.</p>
      <button type="button" className="button button--gold" onClick={onAdd}>
        <Plus size={16} /> Agregar servicio
      </button>
    </div>
  );
}

function App() {
  const [quote, setQuote] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : initialQuote;
    } catch {
      return initialQuote;
    }
  });
  const [openSections, setOpenSections] = useState({
    nora: true,
    client: true,
    items: true,
    conditions: false,
    identity: false,
  });
  const [selectedId, setSelectedId] = useState(quote.items[0]?.id ?? null);
  const [toast, setToast] = useState("");
  const [mobileView, setMobileView] = useState("editor");
  const [noraPrompt, setNoraPrompt] = useState("");
  const [noraSuggestions, setNoraSuggestions] = useState([]);
  const [noraMessage, setNoraMessage] = useState("");
  const [noraError, setNoraError] = useState("");
  const [noraLoading, setNoraLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const logoInput = useRef(null);
  const recognitionRef = useRef(null);

  const totals = useMemo(() => {
    const subtotal = quote.items.reduce(
      (sum, item) => sum + clampNumber(item.quantity) * clampNumber(item.price),
      0,
    );
    const discountAmount = subtotal * (clampNumber(quote.discount) / 100);
    const taxable = subtotal - discountAmount;
    const tax = taxable * (clampNumber(quote.taxRate) / 100);
    return { subtotal, discountAmount, tax, total: taxable + tax };
  }, [quote]);

  const selectedItem = quote.items.find((item) => item.id === selectedId);

  const completeness = useMemo(() => {
    const checks = [
      quote.client,
      quote.folio,
      quote.date,
      quote.items.length > 0,
      quote.items.every((item) => item.name && Number(item.price) > 0),
      quote.paymentTerms,
      quote.notes,
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [quote]);

  useEffect(() => {
    if (!selectedItem && quote.items.length) setSelectedId(quote.items[0].id);
  }, [quote.items, selectedItem]);

  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(quote));
    }, 300);
    return () => clearTimeout(timer);
  }, [quote]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 2200);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(
    () => () => {
      recognitionRef.current?.abort();
    },
    [],
  );

  const updateQuote = (key, value) =>
    setQuote((current) => ({ ...current, [key]: value }));

  const updateItem = (id, key, value) =>
    setQuote((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id === id ? { ...item, [key]: value } : item,
      ),
    }));

  const addItem = () => {
    const item = {
      id: crypto.randomUUID(),
      category: "Consultoría",
      name: "Nuevo servicio",
      description: "Describe el alcance y resultado esperado del servicio.",
      duration: "1 jornada",
      capacity: "1 servicio",
      quantity: 1,
      price: 0,
      deliverable: "Entregable por definir",
    };
    setQuote((current) => ({ ...current, items: [...current.items, item] }));
    setSelectedId(item.id);
    setOpenSections((current) => ({ ...current, items: true }));
  };

  const duplicateItem = (id) => {
    const source = quote.items.find((item) => item.id === id);
    if (!source) return;
    const copy = {
      ...source,
      id: crypto.randomUUID(),
      name: `${source.name} — copia`,
    };
    const index = quote.items.findIndex((item) => item.id === id);
    setQuote((current) => {
      const items = [...current.items];
      items.splice(index + 1, 0, copy);
      return { ...current, items };
    });
    setSelectedId(copy.id);
  };

  const removeItem = (id) => {
    setQuote((current) => ({
      ...current,
      items: current.items.filter((item) => item.id !== id),
    }));
    setToast("Servicio eliminado");
  };

  const moveItem = (id, direction) => {
    setQuote((current) => {
      const index = current.items.findIndex((item) => item.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.items.length) return current;
      const items = [...current.items];
      [items[index], items[target]] = [items[target], items[index]];
      return { ...current, items };
    });
  };

  const saveDraft = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(quote));
    setToast("Borrador guardado en este equipo");
  };

  const toggleDictation = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setNoraError("El dictado funciona en Chrome, Edge y otros navegadores compatibles.");
      return;
    }

    const recognition = new SpeechRecognition();
    const startingText = noraPrompt.trim();
    recognition.lang = "es-MX";
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setNoraError("");
      setIsListening(true);
    };
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0].transcript)
        .join(" ");
      setNoraPrompt([startingText, transcript].filter(Boolean).join(" "));
    };
    recognition.onerror = (event) => {
      setIsListening(false);
      setNoraError(
        event.error === "not-allowed"
          ? "Activa el permiso del micrófono para usar el dictado."
          : "No pude escuchar con claridad. Inténtalo nuevamente.",
      );
    };
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
  };

  const askNora = async () => {
    const prompt = noraPrompt.trim();
    if (prompt.length < 8) {
      setNoraError("Describe o dicta el servicio con un poco más de detalle.");
      return;
    }

    setNoraLoading(true);
    setNoraError("");
    setNoraMessage("");
    setNoraSuggestions([]);

    try {
      const response = await fetch("/api/nora", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, currency: quote.currency }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "NORA no pudo preparar los servicios.");
      }

      setNoraSuggestions(payload.services || []);
      setNoraMessage(payload.message || "Propuesta preparada.");
    } catch (error) {
      setNoraError(error.message || "NORA no pudo conectarse.");
    } finally {
      setNoraLoading(false);
    }
  };

  const applyNoraSuggestions = () => {
    if (!noraSuggestions.length) return;
    const items = noraSuggestions.map((service) => ({
      ...service,
      id: crypto.randomUUID(),
    }));
    setQuote((current) => ({ ...current, items: [...current.items, ...items] }));
    setSelectedId(items[0].id);
    setOpenSections((current) => ({ ...current, items: true }));
    setNoraSuggestions([]);
    setNoraMessage("");
    setNoraPrompt("");
    setToast(`${items.length} servicio${items.length === 1 ? "" : "s"} agregado${items.length === 1 ? "" : "s"}`);
  };

  const resetQuote = () => {
    if (!window.confirm("¿Crear una cotización nueva? Se reemplazará el borrador actual.")) return;
    const fresh = {
      ...initialQuote,
      folio: `PAR-${new Date().getFullYear()}-${String(
        Math.floor(Math.random() * 900) + 100,
      )}`,
      items: [],
    };
    setQuote(fresh);
    setSelectedId(null);
    setToast("Cotización nueva");
  };

  const exportPdf = () => {
    setMobileView("preview");
    setToast("Abriendo vista de impresión");
    setTimeout(() => window.print(), 180);
  };

  const handleLogo = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 2_000_000) {
      setToast("El logotipo debe pesar menos de 2 MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => updateQuote("logo", reader.result);
    reader.readAsDataURL(file);
  };

  const toggleSection = (name) =>
    setOpenSections((current) => ({ ...current, [name]: !current[name] }));

  return (
    <main className="app-shell">
      <Toast message={toast} />

      <header className="mobile-header">
        <BrandMark compact />
        <div className="mobile-header__total">
          <span>Total</span>
          <strong>{money(totals.total, quote.currency)}</strong>
        </div>
      </header>

      <aside className={`editor ${mobileView === "editor" ? "is-mobile-active" : ""}`}>
        <div className="editor__top">
          <BrandMark />
          <div className="editor__edition">
            <span>Cotizador</span>
            <small>Edición comercial 2026</small>
          </div>
        </div>

        <div className="quote-health">
          <div className="quote-health__copy">
            <span>
              <Sparkles size={14} /> Propuesta lista al {completeness}%
            </span>
            <strong>{money(totals.total, quote.currency)}</strong>
          </div>
          <div className="quote-health__bar">
            <span style={{ width: `${completeness}%` }} />
          </div>
        </div>

        <div className="editor__scroll">
          <Section
            icon={Bot}
            title="NORA · Asistente"
            summary="Dicta o describe los servicios"
            open={openSections.nora}
            onToggle={() => toggleSection("nora")}
          >
            <div className="nora-panel">
              <div className="nora-intro">
                <span className="nora-avatar">
                  <Bot size={18} />
                </span>
                <span>
                  <strong>¿Qué necesitas cotizar?</strong>
                  <small>Habla natural; NORA ordena los conceptos.</small>
                </span>
                <span className="nora-model">Flash-Lite</span>
              </div>

              <label className="nora-prompt">
                <span className="field__label">Instrucción para NORA</span>
                <textarea
                  rows="4"
                  maxLength="1200"
                  value={noraPrompt}
                  onChange={(event) => setNoraPrompt(event.target.value)}
                  placeholder="Ejemplo: Sitio web corporativo de 6 secciones, optimizado para móvil, precio de $35,000 e incluye capacitación."
                />
                <small>{noraPrompt.length}/1200 caracteres</small>
              </label>

              <div className="nora-actions">
                <button
                  type="button"
                  className={`nora-mic ${isListening ? "is-listening" : ""}`}
                  onClick={toggleDictation}
                  aria-pressed={isListening}
                >
                  {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                  {isListening ? "Detener" : "Dictar"}
                </button>
                <button
                  type="button"
                  className="nora-generate"
                  onClick={askNora}
                  disabled={noraLoading}
                >
                  {noraLoading ? (
                    <LoaderCircle className="is-spinning" size={16} />
                  ) : (
                    <Sparkles size={16} />
                  )}
                  {noraLoading ? "Preparando…" : "Crear servicios"}
                </button>
              </div>

              {isListening && (
                <div className="nora-listening" role="status">
                  <span />
                  Escuchando… describe servicios, cantidades y precios.
                </div>
              )}

              {noraError && <p className="nora-error" role="alert">{noraError}</p>}

              {noraSuggestions.length > 0 && (
                <div className="nora-result">
                  <div className="nora-result__heading">
                    <span>
                      <Check size={14} />
                      {noraMessage}
                    </span>
                    <small>Revisa antes de agregar</small>
                  </div>
                  <div className="nora-result__list">
                    {noraSuggestions.map((service, index) => (
                      <div key={`${service.name}-${index}`}>
                        <span>{String(index + 1).padStart(2, "0")}</span>
                        <p>
                          <strong>{service.name}</strong>
                          <small>
                            {service.category} · {money(service.price, quote.currency)}
                          </small>
                        </p>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="nora-apply"
                    onClick={applyNoraSuggestions}
                  >
                    <Plus size={15} />
                    Agregar {noraSuggestions.length} a la cotización
                  </button>
                </div>
              )}
            </div>
          </Section>

          <Section
            icon={Building2}
            title="Cliente y folio"
            summary={quote.client || "Identifica la propuesta"}
            open={openSections.client}
            onToggle={() => toggleSection("client")}
          >
            <div className="field-grid">
              <Field
                label="Cliente destinatario"
                icon={Building2}
                value={quote.client}
                placeholder="Ej. Grupo Industrial del Centro"
                onChange={(event) => updateQuote("client", event.target.value)}
                className="field--wide"
              />
              <Field
                label="Persona de contacto"
                icon={UserRound}
                value={quote.contact}
                placeholder="Ej. Ing. Ana Martínez"
                onChange={(event) => updateQuote("contact", event.target.value)}
                className="field--wide"
              />
              <Field
                label="Folio"
                icon={FileText}
                value={quote.folio}
                onChange={(event) => updateQuote("folio", event.target.value)}
              />
              <Field
                label="Fecha de emisión"
                icon={CalendarDays}
                type="date"
                value={quote.date}
                onChange={(event) => updateQuote("date", event.target.value)}
              />
            </div>
          </Section>

          <Section
            icon={BriefcaseBusiness}
            title="Servicios"
            summary={`${quote.items.length} concepto${quote.items.length === 1 ? "" : "s"} en la propuesta`}
            open={openSections.items}
            onToggle={() => toggleSection("items")}
          >
            <div className="items-list">
              {quote.items.map((item, index) => (
                <button
                  className={`item-row ${selectedId === item.id ? "is-selected" : ""}`}
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                >
                  <span className="item-row__index">{String(index + 1).padStart(2, "0")}</span>
                  <span className="item-row__copy">
                    <strong>{item.name || "Servicio sin nombre"}</strong>
                    <small>{money(item.price * item.quantity, quote.currency)}</small>
                  </span>
                  <ChevronDown size={15} />
                </button>
              ))}
              <button type="button" className="add-service" onClick={addItem}>
                <Plus size={16} /> Agregar otro servicio
              </button>
            </div>

            {selectedItem && (
              <div className="item-editor" key={selectedItem.id}>
                <div className="item-editor__head">
                  <span>Editando concepto</span>
                  <div className="item-actions">
                    <button
                      type="button"
                      onClick={() => moveItem(selectedItem.id, -1)}
                      aria-label="Subir servicio"
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveItem(selectedItem.id, 1)}
                      aria-label="Bajar servicio"
                    >
                      <ArrowDown size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => duplicateItem(selectedItem.id)}
                      aria-label="Duplicar servicio"
                    >
                      <Copy size={14} />
                    </button>
                    <button
                      className="danger"
                      type="button"
                      onClick={() => removeItem(selectedItem.id)}
                      aria-label="Eliminar servicio"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="field-grid">
                  <SelectField
                    label="Tipo de servicio"
                    icon={Settings2}
                    value={selectedItem.category}
                    onChange={(event) =>
                      updateItem(selectedItem.id, "category", event.target.value)
                    }
                  >
                    <option>Desarrollo web</option>
                    <option>Marketing digital</option>
                    <option>Identidad visual</option>
                    <option>Contenido</option>
                    <option>Consultoría</option>
                  </SelectField>
                  <Field
                    label="Nombre del servicio"
                    value={selectedItem.name}
                    onChange={(event) =>
                      updateItem(selectedItem.id, "name", event.target.value)
                    }
                    className="field--wide"
                  />
                  <label className="field field--wide">
                    <span className="field__label">Alcance / descripción</span>
                    <textarea
                      rows="3"
                      value={selectedItem.description}
                      onChange={(event) =>
                        updateItem(selectedItem.id, "description", event.target.value)
                      }
                    />
                  </label>
                  <Field
                    label="Duración"
                    value={selectedItem.duration}
                    onChange={(event) =>
                      updateItem(selectedItem.id, "duration", event.target.value)
                    }
                  />
                  <Field
                    label="Capacidad / unidad"
                    value={selectedItem.capacity}
                    onChange={(event) =>
                      updateItem(selectedItem.id, "capacity", event.target.value)
                    }
                  />
                  <Field
                    label="Cantidad"
                    type="number"
                    min="1"
                    step="1"
                    value={selectedItem.quantity}
                    onChange={(event) =>
                      updateItem(selectedItem.id, "quantity", event.target.value)
                    }
                  />
                  <Field
                    label={`Precio unitario (${quote.currency})`}
                    icon={CircleDollarSign}
                    type="number"
                    min="0"
                    step="100"
                    value={selectedItem.price}
                    onChange={(event) =>
                      updateItem(selectedItem.id, "price", event.target.value)
                    }
                  />
                  <Field
                    label="Entregable"
                    value={selectedItem.deliverable}
                    onChange={(event) =>
                      updateItem(selectedItem.id, "deliverable", event.target.value)
                    }
                    className="field--wide"
                  />
                </div>
              </div>
            )}
          </Section>

          <Section
            icon={ReceiptText}
            title="Importes y condiciones"
            summary={`${quote.taxRate}% IVA · ${quote.validDays} días de vigencia`}
            open={openSections.conditions}
            onToggle={() => toggleSection("conditions")}
          >
            <div className="field-grid">
              <SelectField
                label="Moneda"
                value={quote.currency}
                onChange={(event) => updateQuote("currency", event.target.value)}
              >
                <option value="MXN">MXN — Peso mexicano</option>
                <option value="USD">USD — Dólar estadounidense</option>
              </SelectField>
              <Field
                label="Vigencia en días"
                type="number"
                min="1"
                value={quote.validDays}
                onChange={(event) => updateQuote("validDays", event.target.value)}
              />
              <Field
                label="IVA (%)"
                type="number"
                min="0"
                value={quote.taxRate}
                onChange={(event) => updateQuote("taxRate", event.target.value)}
              />
              <Field
                label="Descuento (%)"
                type="number"
                min="0"
                max="100"
                value={quote.discount}
                onChange={(event) => updateQuote("discount", event.target.value)}
              />
              <label className="field field--wide">
                <span className="field__label">Condiciones de pago</span>
                <textarea
                  rows="2"
                  value={quote.paymentTerms}
                  onChange={(event) => updateQuote("paymentTerms", event.target.value)}
                />
              </label>
              <label className="field field--wide">
                <span className="field__label">Notas y exclusiones</span>
                <textarea
                  rows="3"
                  value={quote.notes}
                  onChange={(event) => updateQuote("notes", event.target.value)}
                />
              </label>
            </div>
          </Section>

          <Section
            icon={ImagePlus}
            title="Identidad"
            summary="Logotipo y datos del emisor"
            open={openSections.identity}
            onToggle={() => toggleSection("identity")}
          >
            <div className="field-grid">
              <Field
                label="Empresa emisora"
                value={quote.issuer}
                onChange={(event) => updateQuote("issuer", event.target.value)}
                className="field--wide"
              />
              <Field
                label="Descriptor de marca"
                value={quote.issuerSubtitle}
                onChange={(event) => updateQuote("issuerSubtitle", event.target.value)}
                className="field--wide"
              />
              <div className="logo-upload field--wide">
                <input
                  ref={logoInput}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={handleLogo}
                  hidden
                />
                <button type="button" onClick={() => logoInput.current?.click()}>
                  {quote.logo ? <img src={quote.logo} alt="" /> : <ImagePlus size={19} />}
                  <span>
                    <strong>{quote.logo ? "Cambiar logotipo" : "Subir logotipo"}</strong>
                    <small>PNG, JPG, WEBP o SVG · máximo 2 MB</small>
                  </span>
                </button>
                {quote.logo && (
                  <button
                    className="logo-upload__remove"
                    type="button"
                    onClick={() => updateQuote("logo", "")}
                    aria-label="Quitar logotipo"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          </Section>
        </div>

        <div className="editor__footer">
          <div className="secondary-actions">
            <button type="button" onClick={resetQuote}>
              <RotateCcw size={15} /> Nueva
            </button>
            <button type="button" onClick={saveDraft}>
              <Save size={15} /> Guardar
            </button>
          </div>
          <button type="button" className="export-button" onClick={exportPdf}>
            <Download size={17} />
            Exportar PDF
          </button>
        </div>
      </aside>

      <section className={`preview-pane ${mobileView === "preview" ? "is-mobile-active" : ""}`}>
        <div className="preview-toolbar">
          <div>
            <span className="live-dot" />
            Vista en vivo
            <small>La hoja se actualiza mientras escribes</small>
          </div>
          <button type="button" onClick={exportPdf}>
            <Download size={15} /> Descargar PDF
          </button>
        </div>

        <div className="paper-stage">
          <article className="quote-paper">
            <div className="precision-line" style={{ "--progress": `${completeness}%` }} />
            <header className="paper-header">
              <div className="paper-brand">
                {quote.logo ? (
                  <img src={quote.logo} alt={`Logotipo de ${quote.issuer}`} />
                ) : (
                  <BrandMark dark />
                )}
              </div>
              <div className="paper-title">
                <span>Propuesta comercial</span>
                <h1>Cotización</h1>
                <div>
                  <strong>{quote.folio || "Sin folio"}</strong>
                  <small>{displayDate(quote.date)}</small>
                </div>
              </div>
            </header>

            <section className="client-ribbon">
              <div>
                <span>Preparada para</span>
                <h2>{quote.client || "Nombre del cliente"}</h2>
                <p>{quote.contact || "Persona de contacto"}</p>
              </div>
              <div>
                <span>Vigencia de la propuesta</span>
                <strong>{quote.validDays} días naturales</strong>
                <p>A partir de la fecha de emisión</p>
              </div>
            </section>

            <div className="paper-intro">
              <p>
                Presentamos la siguiente propuesta de servicios, diseñada para
                convertir sus objetivos de marca, comunicación y crecimiento en resultados concretos.
              </p>
              <span>Valores expresados en {quote.currency}</span>
            </div>

            <section className="services-sheet">
              {quote.items.length === 0 ? (
                <EmptyItems onAdd={addItem} />
              ) : (
                quote.items.map((item, index) => (
                  <div className="service-card" key={item.id}>
                    <div className="service-card__number">
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <small>{item.category}</small>
                    </div>
                    <div className="service-card__body">
                      <div className="service-card__main">
                        <div>
                          <h3>{item.name || "Servicio sin nombre"}</h3>
                          <p>{item.description || "Alcance por definir."}</p>
                        </div>
                        <strong>{money(item.price * item.quantity, quote.currency)}</strong>
                      </div>
                      <div className="service-card__meta">
                        <span>
                          <small>Duración</small>
                          {item.duration || "—"}
                        </span>
                        <span>
                          <small>Capacidad</small>
                          {item.capacity || "—"}
                        </span>
                        <span>
                          <small>Cantidad</small>
                          {item.quantity || 0}
                        </span>
                        <span className="service-card__deliverable">
                          <small>Entregable</small>
                          {item.deliverable || "Por definir"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </section>

            <section className="summary-sheet">
              <div className="terms-card">
                <span>Condiciones comerciales</span>
                <strong>{quote.paymentTerms || "Condiciones por definir."}</strong>
                <p>{quote.notes || "Sin notas adicionales."}</p>
              </div>
              <div className="totals-card">
                <div>
                  <span>Subtotal</span>
                  <strong>{money(totals.subtotal, quote.currency)}</strong>
                </div>
                {Number(quote.discount) > 0 && (
                  <div>
                    <span>Descuento ({quote.discount}%)</span>
                    <strong>− {money(totals.discountAmount, quote.currency)}</strong>
                  </div>
                )}
                <div>
                  <span>IVA ({quote.taxRate}%)</span>
                  <strong>{money(totals.tax, quote.currency)}</strong>
                </div>
                <div className="totals-card__grand">
                  <span>Inversión total</span>
                  <strong>{money(totals.total, quote.currency)}</strong>
                  <small>{quote.currency} · Impuestos incluidos</small>
                </div>
              </div>
            </section>

            <footer className="paper-footer">
              <div>
                <span className="paper-footer__seal" aria-hidden="true">
                  <img
                    src="/favicon-cropped.png"
                    alt=""
                  />
                </span>
                <span>
                  <strong>Compromiso PARTUM</strong>
                  Diseño estratégico, ejecución clara y resultados medibles.
                </span>
              </div>
              <p>
                {quote.issuer} · {quote.issuerSubtitle}
              </p>
            </footer>
          </article>
        </div>
      </section>

      <nav className="mobile-switcher" aria-label="Cambiar vista">
        <button
          className={mobileView === "editor" ? "is-active" : ""}
          onClick={() => setMobileView("editor")}
          type="button"
        >
          <Settings2 size={17} /> Editar
        </button>
        <button
          className={mobileView === "preview" ? "is-active" : ""}
          onClick={() => setMobileView("preview")}
          type="button"
        >
          <FileText size={17} /> Vista previa
        </button>
        <button
          className="mobile-switcher__export"
          onClick={exportPdf}
          type="button"
        >
          <Download size={17} /> PDF
        </button>
      </nav>
    </main>
  );
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
