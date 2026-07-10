import * as React from 'react';
import { cn } from '@/lib/utils';

const FALLBACK_IMAGE_URL = '/image-placeholder.svg';

const Image = React.forwardRef(({ src, className, alt = '', onError, ...props }, ref) => {
  const [imageSource, setImageSource] = React.useState(src || FALLBACK_IMAGE_URL);

  React.useEffect(() => {
    setImageSource(src || FALLBACK_IMAGE_URL);
  }, [src]);

  const handleError = event => {
    if (imageSource !== FALLBACK_IMAGE_URL) setImageSource(FALLBACK_IMAGE_URL);
    onError?.(event);
  };

  return (
    <img
      ref={ref}
      src={imageSource}
      alt={alt}
      className={cn(className)}
      onError={handleError}
      {...props}
    />
  );
});

Image.displayName = 'Image';

export { Image };
