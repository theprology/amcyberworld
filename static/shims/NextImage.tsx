/* eslint-disable @next/next/no-img-element */
import type { ImgHTMLAttributes } from 'react';

type StaticImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  src: string;
};

export default function StaticImage({ src, alt = '', ...properties }: StaticImageProps) {
  return <img src={src} alt={alt} {...properties} />;
}
