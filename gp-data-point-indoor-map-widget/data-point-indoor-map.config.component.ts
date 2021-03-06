/**
 * Copyright (c) 2022 Software AG, Darmstadt, Germany and/or its licensors
 *
 * SPDX-License-Identifier: Apache-2.0
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { Component, Input, OnInit } from '@angular/core';
import { BsModalService, BsModalRef } from 'ngx-bootstrap/modal';
import { IManagedObject } from '@c8y/client';
import { AlertService } from '@c8y/ngx-components';
import { DataPointIndoorMapConfigService } from './data-point-indoor-map.config.service';
import { AddThresholdModalComponent } from './add-threshold-modal/add-threshold-modal.component';
import { Threshold, WidgetConfiguration } from './data-point-indoor-map.model';
import { ManagedDatapointsPopupModalComponent } from './managed-datapoints-popup-modal/managed-datapoints-popup-modal.component';

@Component({
  selector: 'data-point-indoor-map-configuration',
  templateUrl: './data-point-indoor-map.config.component.html',
  styleUrls: ['./styles.less'],
  providers: [DataPointIndoorMapConfigService]
})
export class DataPointIndoorMapConfigComponent implements OnInit {
  @Input() config: WidgetConfiguration;

  private readonly DEFAULT_ZOOM_LEVEL = 20;

  mapConfigurations: IManagedObject[];

  dataPointSeries: string[];

  selectedMapConfiguration: IManagedObject;

  selectedDataPoint: string;

  modalRef: BsModalRef;

  constructor(
    private configService: DataPointIndoorMapConfigService,
    private alertService: AlertService,
    private modalService: BsModalService
  ) {}

  ngOnInit() {
    this.initConfiguration();
    this.initMapConfigurations();
    this.initThresholds();
    this.initPopupMarker();
  }

  onMapConfigurationChanged(): void {
    this.config.mapConfigurationId = this.selectedMapConfiguration.id;
    this.updateDataPointSeries();
  }

  onPrimaryMeasurementChanged(): void {
    const measurement: string[] = this.selectedDataPoint.split('.');
    this.config.measurement = { fragment: measurement[0], series: measurement[1] };
  }

  onThresholdClicked(threshold: Threshold) {
    this.displayAddThresholdModal(threshold);
  }

  onAddThresholdButtonClicked(): void {
    this.displayAddThresholdModal();
  }

  onUpdateDatapointsButtonClicked(): void {
    this.displayUpdateDatapointsPopupModal();
  }

  private initConfiguration(): void {
    if (!!this.config && this.config.mapConfigurationId && this.config.measurement) {
      return;
    }

    this.config = Object.assign(this.config, {
      mapConfigurationId: '',
      measurement: {
        fragment: '',
        series: ''
      },
      mapSettings: {
        zoomLevel: this.DEFAULT_ZOOM_LEVEL
      },
      legend: {
        title: '',
        thresholds: []
      },
      datapointsPopup: []
    });
  }

  private initMapConfigurations(): void {
    this.configService.loadSmartMapConfigurations().then(mapConfigurations => {
      this.mapConfigurations = mapConfigurations;

      if (!this.config || !this.config.mapConfigurationId) {
        return;
      }

      this.selectedMapConfiguration = this.mapConfigurations.find(
        mapConfiguration => mapConfiguration.id === this.config.mapConfigurationId
      );
      this.onMapConfigurationChanged();
    });
  }

  private updateDataPointSeries(): void {
    const deviceId: string = this.configService.getDeviceIdFromMapConfiguration(
      this.selectedMapConfiguration
    );

    if (!deviceId) {
      this.alertService.warning(
        'Could not load device configuration based on selected map configuration!'
      );
    }

    this.configService.loadSupportedDataPointSeries(deviceId).then(dataPointSeries => {
      this.dataPointSeries = dataPointSeries;

      if (!this.config || !this.config.measurement) {
        return;
      }

      const measurementStructure = `${this.config.measurement.fragment}.${
        this.config.measurement.series
      }`;
      this.selectedDataPoint = this.dataPointSeries.find(
        dataPoint => dataPoint === measurementStructure
      );

      if (!this.selectedDataPoint) {
        return;
      }

      this.onPrimaryMeasurementChanged();
    });
  }

  private initThresholds(): void {
    if (!this.config || !this.config.legend || !this.config.legend.thresholds) {
      return;
    }

    this.config.legend.thresholds.forEach(threshold => this.addThresholdToList(threshold));
  }

  private initPopupMarker(): void {
    if (!this.config || !this.config.datapointsPopup) {
      return;
    }

    this.config.datapointsPopup = this.config.datapointsPopup;
  }

  private displayAddThresholdModal(thresholdConfiguration?: Threshold) {
    let config = {
      backdrop: true,
      ignoreBackdropClick: true,
      keyboard: false,
      ...(thresholdConfiguration
        ? {
            initialState: { threshold: thresholdConfiguration }
          }
        : {})
    };

    this.modalRef = this.modalService.show(AddThresholdModalComponent, config);
    this.modalRef.content.onSave$.subscribe((threshold: Threshold) => {
      this.addThresholdToList(threshold);
    });
    this.modalRef.content.onDelete$.subscribe((threshold: Threshold) => {
      this.removeThresholdFromList(threshold);
    });
  }

  private displayUpdateDatapointsPopupModal() {
    let config = {
      backdrop: true,
      ignoreBackdropClick: true,
      keyboard: false,
      ...(this.dataPointSeries
        ? {
            initialState: {
              supportedDatapoints: this.dataPointSeries,
              datapointsPopup: this.config.datapointsPopup
            }
          }
        : {})
    };

    this.modalRef = this.modalService.show(ManagedDatapointsPopupModalComponent, config);
    this.modalRef.content.onSave$.subscribe(datapointsPopup => {
      this.config.datapointsPopup = datapointsPopup;
    });
  }

  private addThresholdToList(threshold: Threshold): void {
    let indexExistingThreshold = this.config.legend.thresholds.findIndex(
      existingThreshold => existingThreshold.id === threshold.id
    );

    if (indexExistingThreshold !== -1) {
      this.config.legend.thresholds[indexExistingThreshold] = { ...threshold };
    } else {
      this.config.legend.thresholds.push(threshold);
    }
  }

  private removeThresholdFromList(threshold: Threshold): void {
    let indexExistingThresholdToDelete = this.config.legend.thresholds.findIndex(
      existingThreshold => existingThreshold.id === threshold.id
    );

    if (indexExistingThresholdToDelete === -1) {
      return;
    }

    this.config.legend.thresholds.splice(indexExistingThresholdToDelete, 1);
  }
}
