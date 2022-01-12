import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http'

@Injectable({
  providedIn: 'root'
})
export class DataService {

  constructor(private httpClient: HttpClient) { }

  getCountryData() {
    const localDataPath = '/assets/jsons/country-codes.json';
    return this.httpClient.get(`${localDataPath}`, {});
  }

//   getCoordinates() {
//     const localDataPath = '/assets/jsons/coordinates.json';
//     return this.httpClient.get(`${localDataPath}`, {});
//   }
}
