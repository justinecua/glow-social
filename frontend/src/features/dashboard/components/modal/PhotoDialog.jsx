import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogOverlay,
  DialogPortal,
} from "@/components/ui/dialog";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { X } from "lucide-react";

const PhotoDialog = ({ isOpen, setIsOpen, photos = [], selectedIndex = 0 }) => {
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogPortal>
        <DialogOverlay className="w-full h-full bg-black/80 " />
        <DialogContent
          onOpenAutoFocus={(e) => e.preventDefault()}
          className=" border-0 min-w-[70%] h-[90%] flex items-center justify-center p-0 bg-transparent"
        >
          <DialogClose className="absolute z-10 top-4 right-0 cursor-pointer p-3 rounded-full bg-[var(--button-bg-color)] hover:bg-[var(--button-hover-bg-color)]">
            <X className="w-5 h-5" />
          </DialogClose>
          <Carousel opts={{ startIndex: selectedIndex ?? 0 }} className="w-full">
            <CarouselContent>
              {photos.map((photo, index) => (
                <CarouselItem key={index} className="flex justify-center items-center h-[85vh]">
                  <img
                    src={photo}
                    alt={`Photo ${index + 1}`}
                    className="w-full h-full object-contain"
                  />
                </CarouselItem>
              ))}
            </CarouselContent>
            {photos.length > 1 && (
              <>
                <CarouselPrevious />
                <CarouselNext />
              </>
            )}
          </Carousel>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
};

export default PhotoDialog;
