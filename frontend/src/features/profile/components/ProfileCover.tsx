import { Card, CardContent } from "@/components/ui/card";
import { use, useEffect, useState } from "react";
import NoProfile from "@/assets/images/No-Profile.jpg";
import { Link } from "react-router-dom";
import { ArrowLeft, Car } from "lucide-react";
import { ModeToggle } from "@/components/themes/mode-toggle";
import { Button } from "@/components/ui/button";

const ProfileCover = ({ item }) => {
  const [imgError, setImgError] = useState(false);
  const [coverError, setCoverError] = useState(false);

  return (
    <CardContent className="p-0 w-full relative">
      <Link to={`/`} className="absolute z-2 right-10 top-2">
        <Button variant="outline" size="icon" className="mr-3 cursor-pointer">
          <ArrowLeft className="h-[1.2rem] w-[1.2rem]" />
        </Button>
      </Link>

      <div className="absolute z-2 right-0 top-2">
        <ModeToggle />
      </div>

      <div className="relative w-full h-42 sm:h-44 md:h-50 lg:h-60 xl:h-70 rounded-lg overflow-hidden">
        {!item?.cover_photo || coverError ? (
          <div className="w-full h-full bg-[var(--button-bg-color)]"></div>
        ) : (
          <img
            src={item.cover_photo}
            alt="cover"
            className="w-full h-full object-cover"
            onError={() => setCoverError(true)}
          />
        )}

        {/* <div className="absolute bottom-0 left-0 w-full h-30 fade-overlay" /> */}
      </div>

      <div className="border-8 border-solid border-[var(--home-card)] absolute -bottom-[5.8rem] lg:left-6 w-30 h-30 md:w-40 md:h-40 sm:w-38 sm:h-38 rounded-full overflow-hidden">
        <img
          src={imgError || !item?.profile_photo ? NoProfile : item?.profile_photo}
          alt="profile"
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      </div>
    </CardContent>
  );
};

export default ProfileCover;
