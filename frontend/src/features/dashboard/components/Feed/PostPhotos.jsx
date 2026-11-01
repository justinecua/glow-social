import PostImage from "@/features/posts/PostImage";
import { parseTrend } from "@/features/posts/TrendCard";
import { useEffect, useState } from "react";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";

const PostPhotos = ({ post, isModal = false, isProfile = false, onPhotoClick }) => {
  const [currentSlide, setCurrentSlide] = useState(1);
  const [totalSlides, setTotalSlides] = useState(0);
  const [api, setApi] = useState();

  // Subscribe once per carousel instance (an inline setApi callback used to
  // add a new "select" listener on every render).
  useEffect(() => {
    if (!api) return;
    const update = () => {
      setTotalSlides(api.scrollSnapList().length);
      setCurrentSlide(api.selectedScrollSnap() + 1);
    };
    update();
    api.on("select", update);
    api.on("reInit", update);
    return () => {
      api.off("select", update);
      api.off("reInit", update);
    };
  }, [api]);

  const reactColorBg = isProfile ? "bg-[var(--home-card)]" : "bg-[var(--photo-bg)]";

  const renderPhotos = (photos) => {
    const wrapperClasses = isModal ? "w-full h-full" : "w-full aspect-4/3";

    if (photos.length === 1) {
      return (
        <div className={wrapperClasses} onClick={() => onPhotoClick?.(0)}>
          <PostImage
            src={photos[0]}
            alt="Post"
            loading={isModal ? "eager" : "lazy"}
            decoding="async"
            className="w-full h-full object-contain rounded-lg bg-[var(--photo-bg)] cursor-pointer"
          />
        </div>
      );
    }

    return (
      <div className={`relative ${wrapperClasses}`}>
        <Carousel className={`w-full ${isModal ? "h-full" : ""}`} setApi={setApi}>
          <CarouselContent
            viewportClassName={isModal ? "h-full" : ""}
            className={isModal ? "h-full" : ""}
          >
            {photos.map((photo, index) => (
              <CarouselItem
                key={index}
                className={`flex justify-center items-center ${
                  isModal ? "h-full" : "aspect-[4/3]"
                }`}
              >
                <div onClick={() => onPhotoClick?.(index)} className="cursor-pointer w-full h-full">
                  <PostImage
                    src={photo}
                    alt={`Photo ${index + 1}`}
                    loading={isModal && index === 0 ? "eager" : "lazy"}
                    decoding="async"
                    className={`w-full h-full object-contain rounded-lg ${reactColorBg}`}
                  />
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>

        <div className="absolute top-4 right-4 z-1">
          <div className="bg-[var(--home-card)] text-xs font-medium px-3 py-1.5 rounded-full flex items-center gap-1.5">
            <span>{currentSlide}</span>
            <span>/</span>
            <span>{totalSlides}</span>
          </div>
        </div>
      </div>
    );
  };

  // Trend posts show their thumbnail inside the trend card instead.
  if (post?.is_bot && parseTrend(post?.caption)) return null;

  return (
    <div
      className={`w-full h-full ${
        isModal ? "" : "mt-4 mb-2 object-contain"
      } rounded-lg ${reactColorBg}`}
    >
      {post?.photos?.length > 0 && (
        <div className={`${isModal ? "h-full " : ""}`}>{renderPhotos(post.photos)}</div>
      )}
    </div>
  );
};

export default PostPhotos;
