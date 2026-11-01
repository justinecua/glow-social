from django.urls import path

from .views import SparkDetail, Sparks, ViewSpark, WarmSpark

urlpatterns = [
    path("", Sparks.as_view(), name="sparks"),
    path("<int:spark_id>/", SparkDetail.as_view(), name="sparkDetail"),
    path("<int:spark_id>/view/", ViewSpark.as_view(), name="viewSpark"),
    path("<int:spark_id>/warm/", WarmSpark.as_view(), name="warmSpark"),
]
