'use client';
/**
 * Campo de dirección con desplegable de sugerencias (Google Places API New).
 * Al elegir una sugerencia se devuelven dirección exacta + coordenadas.
 */
import { useEffect, useRef, useState } from 'react';
import { loadMaps } from '@/lib/maps';
import { appConfig } from '@/config/brand.config';
import Icon from './Icon';

export default function AddressInput({ value, onTyping, onPick, picked, error, name = 'address', onBlur }) {
  const [options, setOptions] = useState([]);
  const [open, setOpen] = useState(false);
  const [mapsError, setMapsError] = useState('');
  const tokenRef = useRef(null);
  const timer = useRef();

  // Cada vez que se escribe (y no se ha elegido ya una opción) se piden sugerencias.
  useEffect(() => {
    clearTimeout(timer.current);
    if (picked || !value || value.trim().length < 4) { setOptions([]); return; }
    timer.current = setTimeout(async () => {
      try {
        const maps = await loadMaps();
        const { AutocompleteSuggestion, AutocompleteSessionToken } = await maps.importLibrary('places');
        tokenRef.current ??= new AutocompleteSessionToken(); // agrupa la sesión (más barato)
        const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: value, sessionToken: tokenRef.current,
          includedRegionCodes: [appConfig.maps.country], language: 'es',
        });
        setOptions(suggestions.map((s) => s.placePrediction));
        setOpen(true);
      } catch (e) { setMapsError(e.message); }
    }, 300); // espera 300 ms tras dejar de escribir
    return () => clearTimeout(timer.current);
  }, [value, picked]);

  const choose = async (prediction) => {
    const place = prediction.toPlace();
    await place.fetchFields({ fields: ['formattedAddress', 'location', 'id'] });
    tokenRef.current = null; // la sesión termina al elegir
    setOpen(false);
    onPick({ address: place.formattedAddress, lat: place.location.lat(), lng: place.location.lng(), place_id: place.id });
  };

  return (
    <div className="relative">
      <div className="relative">
        <Icon name="pin" className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-faint" />
        <input name={name} className={`field !pl-10 ${error ? 'field-error' : ''}`} value={value} onChange={(e) => onTyping(e.target.value)} onBlur={onBlur}
          placeholder="Calle, número, ciudad" autoComplete="off" aria-invalid={error ? 'true' : undefined}
          onFocus={() => options.length && setOpen(true)} />
      </div>
      {picked && <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400"><Icon name="checkCircle" className="h-3.5 w-3.5" />Dirección verificada en el mapa</p>}
      {!picked && value && !error && <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">Elige una dirección de la lista para ubicarla en el mapa.</p>}
      {mapsError && <p className="mt-1.5 text-xs text-red-600">{mapsError}</p>}
      {open && options.length > 0 && (
        <ul className="pop absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-line bg-surface shadow-xl">
          {options.map((p) => (
            <li key={p.placeId}>
              <button type="button" onClick={() => choose(p)} className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left text-sm hover:bg-sunken">
                <Icon name="pin" className="mt-0.5 h-4 w-4 text-faint" />{p.text.text}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
