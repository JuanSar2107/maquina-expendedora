import { memo } from 'react';
import { AVATARES, SPRITES } from '../sprites.js';

/** Dibuja un sprite como SVG: un rectángulo por píxel, sin suavizado. */
function PixelArte({ sprite, tamano = 48, avatar = false, className = '', titulo }) {
  const datos = (avatar ? AVATARES : SPRITES)[sprite] ?? SPRITES.caja;
  const alto = datos.pixeles.length;
  const ancho = Math.max(...datos.pixeles.map((f) => f.length));
  const rects = [];
  datos.pixeles.forEach((fila, y) => {
    [...fila].forEach((letra, x) => {
      const color = datos.paleta[letra];
      if (color) rects.push(<rect key={`${x}-${y}`} x={x} y={y} width="1.02" height="1.02" fill={color} />);
    });
  });
  return (
    <svg
      className={`pixel ${className}`}
      viewBox={`0 0 ${ancho} ${alto}`}
      width={tamano}
      height={(tamano * alto) / ancho}
      shapeRendering="crispEdges"
      role="img"
      aria-label={titulo ?? sprite}
    >
      {rects}
    </svg>
  );
}

export default memo(PixelArte);
