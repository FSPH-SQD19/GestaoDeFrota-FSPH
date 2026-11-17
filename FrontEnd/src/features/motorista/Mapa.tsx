import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { Feature, LineString } from "geojson";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
maplibregl.setWorkerUrl(workerUrl);
import "maplibre-gl/dist/maplibre-gl.css";
import type { Coordenadas, Ponto, Rota } from "./types";
export default function Mapa({
  pontos = [],
  posicao,
  rota,
  onPick,
  focus,
  fullscreen = false,
  recenterToken = 0,
}: {
  pontos?: Ponto[];
  posicao?: Coordenadas;
  rota?: Rota;
  onPick?: (p: Coordenadas) => void;
  focus?: Coordenadas;
  fullscreen?: boolean;
  recenterToken?: number;
}) {
  const container = useRef<HTMLDivElement>(null),
    map = useRef<maplibregl.Map | null>(null),
    pick = useRef(onPick);
  useEffect(() => {
    pick.current = onPick;
  }, [onPick]);
  const [erro, setErro] = useState("");
  useEffect(() => {
    if (!container.current) return;
    let instance: maplibregl.Map;
    try {
      instance = new maplibregl.Map({
        container: container.current,
        style: import.meta.env.VITE_MAP_STYLE_URL || "https://tiles.openfreemap.org/styles/liberty",
        center: [-37.07, -10.91],
        zoom: fullscreen ? 13 : 11,
        attributionControl: fullscreen ? false : undefined,
      });
    } catch {
      queueMicrotask(() =>
        setErro("Mapa indisponível neste aparelho. O diário continua disponível."),
      );
      return;
    }
    map.current = instance;
    if (!fullscreen) instance.addControl(new maplibregl.NavigationControl());
    else instance.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
    instance.on("error", () =>
      setErro("Não foi possível carregar parte do mapa. Confira a conexão."),
    );
    instance.on("click", (e) => pick.current?.([e.lngLat.lng, e.lngLat.lat]));
    return () => {
      map.current = null;
      instance.remove();
    };
  }, [fullscreen]);
  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    const markers: maplibregl.Marker[] = [];
    for (const ponto of pontos)
      if (ponto.coordenadas)
        markers.push(
          new maplibregl.Marker({ color: fullscreen ? "#101828" : "#64748b" })
            .setLngLat(ponto.coordenadas)
            .setPopup(new maplibregl.Popup().setText(ponto.nome))
            .addTo(instance),
        );
    if (posicao) {
      const element = document.createElement("div");
      element.className = "driver-location-marker";
      element.setAttribute("aria-label", "Sua localização");
      element.innerHTML =
        '<svg width="25" height="25" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 20 21 12 17 4 21Z" fill="#2563eb" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg>';
      markers.push(
        new maplibregl.Marker(fullscreen ? { element, anchor: "center" } : { color: "#2563eb" })
          .setLngLat(posicao)
          .setPopup(new maplibregl.Popup().setText("Posição atual"))
          .addTo(instance),
      );
    }
    const update = () => {
      if (!instance.isStyleLoaded()) return;
      const source = instance.getSource("rota") as maplibregl.GeoJSONSource | undefined;
      const data: Feature<LineString> = {
        type: "Feature",
        properties: {},
        geometry: rota?.geometry ?? { type: "LineString", coordinates: [] },
      };
      if (source) source.setData(data);
      else {
        instance.addSource("rota", { type: "geojson", data });
        instance.addLayer({
          id: "rota",
          type: "line",
          source: "rota",
          paint: { "line-color": "#2563eb", "line-width": 5 },
        });
      }
    };
    instance.on("load", update);
    update();
    return () => {
      instance.off("load", update);
      markers.forEach((m) => m.remove());
    };
  }, [pontos, posicao, rota, fullscreen]);
  const camera = useRef({ posicao, focus });
  useEffect(() => {
    camera.current = { posicao, focus };
  }, [posicao, focus]);
  const followPosition = fullscreen ? undefined : posicao;
  const focusLng = focus?.[0],
    focusLat = focus?.[1];
  useEffect(() => {
    if (!rota?.geometry.coordinates.length) return;
    const bounds = new maplibregl.LngLatBounds();
    rota.geometry.coordinates.forEach((p) => bounds.extend(p));
    const padding = fullscreen
      ? window.matchMedia("(min-width:768px)").matches
        ? { top: 80, bottom: 80, left: 460, right: 60 }
        : {
            top: window.innerHeight <= 650 ? 120 : 250,
            bottom: Math.min(window.innerHeight * 0.42, 370) + 64,
            left: 30,
            right: 30,
          }
      : 40;
    map.current?.fitBounds(bounds, { padding, maxZoom: 15 });
  }, [rota, fullscreen]);
  useEffect(() => {
    const center = camera.current.posicao ?? camera.current.focus;
    if (center)
      map.current?.easeTo({
        center,
        offset: fullscreen
          ? window.matchMedia("(min-width:768px)").matches
            ? [200, 0]
            : [0, -Math.min(window.innerHeight * 0.2, 180)]
          : [0, 0],
      });
  }, [followPosition, focusLng, focusLat, recenterToken, fullscreen]);
  return (
    <div className={fullscreen ? "driver-map" : "space-y-2"}>
      <div
        ref={container}
        role="region"
        aria-label="Mapa operacional"
        className={
          fullscreen ? "driver-map-canvas" : "h-80 w-full rounded-2xl border border-slate-200"
        }
      />
      {erro && (
        <p role="status" className={fullscreen ? "driver-map-error" : "text-sm text-amber-800"}>
          {erro}
        </p>
      )}
    </div>
  );
}
