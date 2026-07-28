import React from 'react';
import { TakeawayCoffeeIcon } from '../../../../src/app/components/TakeawayCoffeeIcon';
import './CoffeeIcon.css';

/**
 * Brand takeaway coffee PNG.
 * @param {boolean} framed — cream badge behind the art (for navy/green backgrounds)
 * @param {'sm'|'md'|'lg'|'inline'} frameSize
 */
export function CoffeeIcon({
  className = '',
  size = 20,
  framed = false,
  frameSize = 'md',
}) {
  const img = (
    <TakeawayCoffeeIcon
      className={framed ? 'coffee-icon-img' : className}
      size={size}
      style={framed ? { mixBlendMode: 'normal' } : undefined}
    />
  );

  if (!framed) {
    return img;
  }

  const frameClass = `coffee-icon-frame coffee-icon-frame--${frameSize}${className ? ` ${className}` : ''}`;

  return (
    <span className={frameClass} aria-hidden="true">
      {img}
    </span>
  );
}
