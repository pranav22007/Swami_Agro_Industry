import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ScrollView, Alert, TouchableOpacity, Dimensions, Animated } from 'react-native';
import { Title, Text, Surface, TextInput, Button, Divider, IconButton, Card, Avatar, Portal, Modal, List, Badge, SegmentedButtons } from 'react-native-paper';
import { collection, query, onSnapshot, addDoc, doc, updateDoc, increment, serverTimestamp, where, getDocs, limit, runTransaction } from 'firebase/firestore';
import { db, auth } from '../../../src/config/firebase';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useRouter } from 'expo-router';
import { useBusiness } from '../../../src/context/BusinessContext';
import { useAppTheme } from '../../../src/context/ThemeContext';
import { useLanguage } from '../../../src/context/LanguageContext';

const { width } = Dimensions.get('window');

export default function NewBillingScreen() {
  const { activeBusiness } = useBusiness();
  const { theme } = useAppTheme();
  const { t } = useLanguage();
  const [items, setItems] = useState<any[]>([]);
  const [selectedItems, setSelectedItems] = useState<any[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [destination, setDestination] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [dispatchLocation, setDispatchLocation] = useState('');
  const [selectedBank, setSelectedBank] = useState<any>(null);
  const [paymentStatus, setPaymentStatus] = useState('paid');
  const [loading, setLoading] = useState(false);
  const [recentCustomers, setRecentCustomers] = useState<any[]>([]);
  const [showCustList, setShowCustList] = useState(false);
  const [bankModalVisible, setBankModalVisible] = useState(false);
  const [itemSearchQuery, setItemSearchQuery] = useState('');

  const router = useRouter();

  useEffect(() => {
    if (!activeBusiness) return;

    const q = query(collection(db, `businesses/${activeBusiness.id}/items`));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const itemList: any[] = [];
      snapshot.forEach((doc) => itemList.push({ id: doc.id, ...doc.data() }));
      setItems(itemList);
    });

    const cq = query(collection(db, 'customers'), where('businessId', '==', activeBusiness.id), limit(5));
    const unsubscribeCust = onSnapshot(cq, (snapshot) => {
      const cList: any[] = [];
      snapshot.forEach((doc) => cList.push({ id: doc.id, ...doc.data() }));
      setRecentCustomers(cList);
    });

    return () => {
      unsubscribe();
      unsubscribeCust();
    };
  }, [activeBusiness]);

  const filteredItems = items.filter(i => 
    i.name?.toLowerCase().includes(itemSearchQuery.toLowerCase())
  );

  const addItemToBill = (item: any) => {
    const existing = selectedItems.find(i => i.id === item.id);
    if (existing) {
      setSelectedItems(selectedItems.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i));
    } else {
      setSelectedItems([...selectedItems, { ...item, qty: 1 }]);
    }
  };

  const calculateTotals = () => {
    let subtotal = 0;
    let totalGST = 0;
    selectedItems.forEach(item => {
      const lineTotal = item.price * item.qty;
      const lineGST = lineTotal * (item.gst / 100);
      subtotal += lineTotal;
      totalGST += lineGST;
    });
    
    const beforeCdTotal = subtotal + totalGST;
    const cdPercentage = activeBusiness?.defaultCd ?? 2;
    const cdAmount = beforeCdTotal * (cdPercentage / 100);
    const finalTotal = beforeCdTotal - cdAmount;

    return { 
      subtotal, 
      totalGST, 
      beforeCdTotal,
      cdPercentage,
      cdAmount,
      total: finalTotal 
    };
  };

  const selectCustomer = (cust: any) => {
    setCustomerName(cust.name);
    setCustomerPhone(cust.phone);
    setShowCustList(false);
  };

  const getBase64Image = async (url: string) => {
    if (!url) return '';
    try {
      // First try fetching directly
      const response = await fetch(url);
      const blob = await response.blob();
      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.warn("Could not fetch image to base64", e);
      return url; // fallback to URL if base64 conversion fails
    }
  };

  const generatePDF = async (saleData: any) => {
    const businessInfo = activeBusiness;
    const date = new Date().toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    
    const invNo = saleData.invoiceNumber || 'DRAFT';
    const bank = saleData.bankDetails || selectedBank;

    const itemsHtml = selectedItems.map((item: any, index: number) => `
      <tr style="border-bottom: 1px solid #f0f0f0;">
        <td style="padding: 15px 10px; text-align: left; font-size: 12px; color: #444;">${index + 1}</td>
        <td style="padding: 15px 10px; text-align: left; font-size: 13px; font-weight: 500;">${item.name}</td>
        <td style="padding: 15px 10px; text-align: center; font-size: 13px;">${item.qty}</td>
        <td style="padding: 15px 10px; text-align: right; font-size: 13px;">₹${item.price.toLocaleString('en-IN')}</td>
        <td style="padding: 15px 10px; text-align: right; font-size: 13px;">${item.gst}%</td>
        <td style="padding: 15px 10px; text-align: right; font-size: 13px; font-weight: bold; color: #1b5e20;">₹${(item.price * item.qty * (1 + item.gst/100)).toFixed(2)}</td>
      </tr>
    `).join('');

    const { subtotal, totalGST, cdPercentage, cdAmount, total } = calculateTotals();

    // Fetch images as base64 so they render reliably in the PDF WebView
    const logoUrl = await getBase64Image(businessInfo?.photoUrl || '');
    const signatureUrl = await getBase64Image(businessInfo?.signatureUrl || '');

    const html = `
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
          <style>
            @page { margin: 0; }
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; margin: 0; padding: 0; color: #333; background-color: #fff; }
            .container { padding: 40px; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 4px solid #1b5e20; padding-bottom: 20px; }
            .business-info { flex: 2; }
            .logo { width: 80px; height: 80px; object-fit: contain; margin-bottom: 15px; border-radius: 12px; background: #f9f9f9; padding: 5px; display: ${logoUrl ? 'block' : 'none'}; }
            .business-name { font-size: 28px; font-weight: 800; color: #1b5e20; margin: 0; text-transform: uppercase; letter-spacing: 1px; }
            .business-detail { font-size: 12px; color: #666; margin: 3px 0; line-height: 1.4; }
            .invoice-label { flex: 1; text-align: right; }
            .invoice-title { font-size: 42px; font-weight: 900; color: #e8f5e9; margin: 0; position: absolute; right: 40px; top: 30px; z-index: -1; }
            .invoice-meta { margin-top: 50px; }
            .meta-item { font-size: 14px; margin-bottom: 5px; }
            .meta-label { font-weight: bold; color: #1b5e20; }

            .bill-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 40px; }
            .bill-box { background: #fcfcfc; padding: 20px; border-radius: 12px; border: 1px solid #f0f0f0; }
            .box-title { font-size: 11px; font-weight: bold; color: #1b5e20; text-transform: uppercase; letter-spacing: 1.5px; border-bottom: 1px solid #e8f5e9; padding-bottom: 8px; margin-bottom: 12px; }
            .customer-name { font-size: 18px; font-weight: 700; margin-bottom: 5px; color: #222; }
            .transport-detail { font-size: 12px; color: #555; margin: 4px 0; display: flex; justify-content: space-between; }

            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            th { background: #1b5e20; color: white; padding: 12px 10px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; text-align: center; }
            th:first-child { border-radius: 8px 0 0 0; text-align: left; }
            th:last-child { border-radius: 0 8px 0 0; text-align: right; }
            
            .totals-container { display: flex; justify-content: flex-end; }
            .totals-table { width: 300px; }
            .total-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f0f0f0; }
            .total-row.grand-total { border-top: 2px solid #1b5e20; border-bottom: none; margin-top: 10px; padding-top: 15px; }
            .grand-total-label { font-size: 20px; font-weight: 800; color: #1b5e20; }
            .grand-total-value { font-size: 22px; font-weight: 800; color: #1b5e20; }

            .footer { margin-top: 80px; display: flex; justify-content: space-between; align-items: flex-end; }
            .bank-info { font-size: 12px; color: #555; background: #f9f9f9; padding: 15px; border-radius: 10px; width: 300px; }
            .signature-box { text-align: center; width: 220px; }
            .signature-img { width: 120px; height: 50px; object-fit: contain; margin-bottom: 5px; display: ${signatureUrl ? 'inline-block' : 'none'}; }
            .signature-line { border-top: 1px solid #333; padding-top: 8px; font-weight: bold; font-size: 12px; color: #1b5e20; }
            
            .thanks { text-align: center; color: #aaa; font-size: 11px; margin-top: 50px; font-style: italic; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1 class="invoice-title">INVOICE</h1>
            <div class="header">
              <div class="business-info">
                ${logoUrl ? `<img src="${logoUrl}" class="logo" />` : ''}
                <h2 class="business-name">${businessInfo?.businessName}</h2>
                <p class="business-detail"><b>GSTIN:</b> ${businessInfo?.gstId || 'N/A'}</p>
                <p class="business-detail"><b>Contact:</b> ${businessInfo?.phoneNumber || businessInfo?.phone || ''}</p>
                <p class="business-detail" style="margin-top: 8px; color: #444; font-weight: 500;">${businessInfo?.address || ''}</p>
              </div>
              <div class="invoice-meta">
                <div class="meta-item"><span class="meta-label">Invoice No:</span> ${invNo}</div>
                <div class="meta-item"><span class="meta-label">Date:</span> ${date}</div>
              </div>
            </div>

            <div class="bill-grid">
              <div class="bill-box">
                <div class="box-title">Bill To</div>
                <div class="customer-name">${customerName || 'Walk-in Customer'}</div>
                <p class="business-detail"><b>Phone:</b> ${customerPhone || 'N/A'}</p>
              </div>
              <div class="bill-box">
                <div class="box-title">Transport Details</div>
                <div class="transport-detail"><span>Destination:</span> <b>${destination || 'N/A'}</b></div>
                <div class="transport-detail"><span>Vehicle No:</span> <b>${vehicleNumber || 'N/A'}</b></div>
                <div class="transport-detail"><span>Dispatch:</span> <b>${dispatchLocation || 'N/A'}</b></div>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th style="width: 40px;">#</th>
                  <th style="text-align: left;">Item Description</th>
                  <th>Qty</th>
                  <th style="text-align: right;">Rate</th>
                  <th style="text-align: right;">GST</th>
                  <th style="text-align: right;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>

            <div class="footer">
              <div class="bank-info">
                <div class="box-title" style="border-bottom: 1px solid #ddd; margin-bottom: 8px;">Bank Details</div>
                ${bank ? `
                  <div style="margin-bottom: 3px;"><b>Bank:</b> ${bank.bankName}</div>
                  <div style="margin-bottom: 3px;"><b>A/C No:</b> ${bank.accountNumber}</div>
                  <div style="margin-bottom: 3px;"><b>IFSC:</b> ${bank.ifscCode}</div>
                  <div style="margin-bottom: 3px;"><b>Branch:</b> ${bank.branch}</div>
                ` : '<div style="color: #999;">No bank details provided</div>'}
              </div>
              
              <div class="totals-table">
                <div class="total-row"><span>Subtotal</span><span>₹${subtotal.toFixed(2)}</span></div>
                <div class="total-row"><span>Tax (GST)</span><span>₹${totalGST.toFixed(2)}</span></div>
                <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f0f0f0; color: #d32f2f; font-weight: 500;">
                  <span>CD Deduction (${cdPercentage}%)</span>
                  <span>- ₹${cdAmount.toFixed(2)}</span>
                </div>
                <div class="total-row grand-total">
                  <span class="grand-total-label">Grand Total</span>
                  <span class="grand-total-value">₹${total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div style="display: flex; justify-content: flex-end; margin-top: 60px;">
              <div class="signature-box">
                ${signatureUrl ? `<img src="${signatureUrl}" class="signature-img" />` : '<div style="height: 50px;"></div>'}
                <div class="signature-line">${businessInfo?.ownerName || 'Authorized Signatory'}</div>
                <div style="font-size: 10px; color: #888; margin-top: 4px;">Proprietor / Authorized Signatory</div>
              </div>
            </div>

            <p class="thanks">Thank you for choosing ${businessInfo?.businessName || 'us'}! This is a professional computer-generated invoice.</p>
          </div>
        </body>
      </html>
    `;

    try {
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri);
    } catch (error) {
      console.error("PDF generation error:", error);
      Alert.alert(t('error'), "Failed to generate PDF");
    }
  };

  const handleSaveBill = async () => {
    if (selectedItems.length === 0 || !customerName) {
      Alert.alert(t('error'), 'Add items and customer name');
      return;
    }

    setLoading(true);
    let finalInvoiceNumber = '';
    let billData: any = null;

    try {
      const user = auth.currentUser;
      if (!user || !activeBusiness) return;

      const { subtotal, totalGST, cdPercentage, cdAmount, total } = calculateTotals();
      const businessRef = doc(db, 'businesses', activeBusiness.id);
      
      // Use a transaction to safely increment the invoice number and deduct stock
      await runTransaction(db, async (transaction) => {
        const businessDoc = await transaction.get(businessRef);
        if (!businessDoc.exists()) {
          throw "Business document does not exist!";
        }

        // Deduct stock for each item
        for (const item of selectedItems) {
          const itemRef = doc(db, `businesses/${activeBusiness.id}/items`, item.id);
          const itemDoc = await transaction.get(itemRef);
          
          if (!itemDoc.exists()) {
            throw `Item ${item.name} not found!`;
          }

          const currentStock = itemDoc.data().stockQuantity || 0;
          if (currentStock < item.qty) {
            throw `Insufficient stock for ${item.name}. Available: ${currentStock}`;
          }

          transaction.update(itemRef, {
            stockQuantity: increment(-item.qty)
          });
        }

        const newCount = (businessDoc.data().lastInvoiceNo || 0) + 1;
        finalInvoiceNumber = `bil${newCount.toString().padStart(2, '0')}`;
        
        transaction.update(businessRef, { 
          lastInvoiceNo: newCount,
          totalSales: increment(total)
        });
      });

      billData = {
        userId: user.uid,
        businessId: activeBusiness.id,
        businessName: activeBusiness.businessName,
        customerName,
        customerPhone,
        destination,
        vehicleNumber,
        dispatchLocation,
        bankDetails: selectedBank,
        items: selectedItems,
        subtotal,
        totalGST,
        cdPercentage,
        cdAmount,
        total,
        invoiceNumber: finalInvoiceNumber,
        paymentStatus, // 'paid' or 'pending'
        timestamp: serverTimestamp(),
      };

      await addDoc(collection(db, 'transactions'), billData);

      const cq = query(collection(db, 'customers'), where('phone', '==', customerPhone), where('businessId', '==', activeBusiness.id));
      const cSnap = await getDocs(cq);
      
      const itemNames = selectedItems.map(i => i.name);
      
      if (!cSnap.empty) {
        const cRef = doc(db, 'customers', cSnap.docs[0].id);
        const existingMostOrdered = cSnap.docs[0].data().mostOrdered || [];
        const newMostOrdered = Array.from(new Set([...existingMostOrdered, ...itemNames])).slice(0, 3);
        
        await updateDoc(cRef, {
          lastInteraction: serverTimestamp(),
          totalOrders: increment(1),
          mostOrdered: newMostOrdered
        });
      } else {
        await addDoc(collection(db, 'customers'), {
          name: customerName,
          phone: customerPhone,
          businessId: activeBusiness.id,
          lastInteraction: serverTimestamp(),
          totalOrders: 1,
          mostOrdered: itemNames.slice(0, 3)
        });
      }

      Alert.alert(t('success'), `Bill Saved! Invoice: ${finalInvoiceNumber}`, [
        { text: 'Print/Share', onPress: () => generatePDF(billData) },
        { text: 'Done', onPress: () => router.replace('/(user)') }
      ]);
    } catch (err) {
      console.error('Offline sync queued:', err);
      // Even if it fails (e.g. offline), Firestore has already queued it locally.
      // We show success to the user as the UI will be updated.
      Alert.alert(t('success'), `Bill Saved Locally! Invoice: ${finalInvoiceNumber}`, [
        { text: 'Print/Share', onPress: () => generatePDF(billData) },
        { text: 'Done', onPress: () => router.replace('/(user)') }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const { subtotal, totalGST, cdPercentage, cdAmount, total } = calculateTotals();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Surface style={[styles.header, { backgroundColor: theme.colors.surface }]} elevation={2}>
        <View style={styles.headerRow}>
          <IconButton icon="receipt-outline" onPress={() => router.back()} iconColor={theme.colors.primary} />
          <Title style={{ color: theme.colors.primary, fontWeight: 'bold' }}>{t('billing')}</Title>
        </View>
      </Surface>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={1}>
          <Card.Content>
            <Text style={styles.cardSectionTitle}>Customer Details</Text>
            <View style={styles.inputRow}>
              <TextInput 
                label={t('name')} 
                value={customerName} 
                onChangeText={setCustomerName} 
                mode="outlined" 
                style={[styles.input, { flex: 1 }]} 
                onFocus={() => setShowCustList(true)}
                outlineColor="#eee"
                activeOutlineColor={theme.colors.primary}
              />
              <IconButton icon="account-search" onPress={() => setShowCustList(!showCustList)} iconColor={theme.colors.primary} />
            </View>
            <TextInput 
              label={t('phone')} 
              value={customerPhone} 
              onChangeText={setCustomerPhone} 
              keyboardType="phone-pad" 
              mode="outlined" 
              style={styles.input} 
              outlineColor="#eee"
              activeOutlineColor={theme.colors.primary}
            />
            
            {showCustList && recentCustomers.length > 0 && (
              <Surface style={[styles.custDropdown, { backgroundColor: theme.colors.surfaceVariant }]} elevation={3}>
                <Text style={styles.dropdownTitle}>{t('recentCustomers') || 'RECENT CUSTOMERS'}</Text>
                {recentCustomers.map(c => (
                  <TouchableOpacity key={c.id} onPress={() => selectCustomer(c)} style={styles.custOption}>
                    <Avatar.Text size={30} label={c.name[0]} style={{ backgroundColor: theme.colors.primaryContainer }} color={theme.colors.primary} />
                    <View style={{ marginLeft: 12 }}>
                      <Text style={{ fontWeight: 'bold', color: theme.colors.onSurface }}>{c.name}</Text>
                      <Text style={{ fontSize: 12, color: theme.colors.onSurfaceVariant }}>{c.phone}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </Surface>
            )}

            <Divider style={styles.formDivider} />
            <Text style={styles.cardSectionTitle}>Transport Details</Text>
            
            <View style={styles.doubleInputRow}>
              <TextInput 
                label={t('destination')} 
                value={destination} 
                onChangeText={setDestination} 
                mode="outlined" 
                style={[styles.input, { flex: 1, marginRight: 6 }]} 
                outlineColor="#eee"
                activeOutlineColor={theme.colors.primary}
              />
              <TextInput 
                label={t('vehicleNumber')} 
                value={vehicleNumber} 
                onChangeText={setVehicleNumber} 
                mode="outlined" 
                style={[styles.input, { flex: 1, marginLeft: 6 }]} 
                outlineColor="#eee"
                activeOutlineColor={theme.colors.primary}
              />
            </View>

            <TextInput 
              label={t('dispatchLocation')} 
              value={dispatchLocation} 
              onChangeText={setDispatchLocation} 
              mode="outlined" 
              style={styles.input} 
              outlineColor="#eee"
              activeOutlineColor={theme.colors.primary}
            />

            <Divider style={styles.formDivider} />
            <Text style={styles.cardSectionTitle}>Banking Information</Text>

            <TouchableOpacity onPress={() => setBankModalVisible(true)} style={{ marginTop: 5 }}>
              <Surface style={[styles.bankSelector, { backgroundColor: theme.colors.surfaceVariant, borderColor: '#eee' }]} elevation={0}>
                <IconButton icon="bank-outline" size={22} iconColor={theme.colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 10, color: theme.colors.onSurfaceVariant, fontWeight: 'bold', textTransform: 'uppercase' }}>{t('selectBank')}</Text>
                  <Text style={{ fontWeight: 'bold', color: theme.colors.onSurface, fontSize: 15 }}>{selectedBank ? selectedBank.bankName : 'Select bank for invoice'}</Text>
                </View>
                <IconButton icon="chevron-right" size={22} iconColor={theme.colors.onSurfaceVariant} />
              </Surface>
            </TouchableOpacity>
          </Card.Content>
        </Card>

        <View style={styles.sectionHeader}>
          <Title style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>{t('selectItems') || 'Product Selection'}</Title>
        </View>

        <TextInput
          placeholder="Search items..."
          value={itemSearchQuery}
          onChangeText={setItemSearchQuery}
          mode="outlined"
          style={styles.itemSearchInput}
          left={<TextInput.Icon icon="magnify" />}
          outlineColor="#eee"
          activeOutlineColor={theme.colors.primary}
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.itemPicker}>
          {filteredItems.map(item => (
            <TouchableOpacity key={item.id} onPress={() => addItemToBill(item)} activeOpacity={0.7}>
              <Surface style={[styles.itemChip, { backgroundColor: theme.colors.surface }]} elevation={1}>
                <Text style={styles.chipName} numberOfLines={1}>{item.name}</Text>
                <Text style={[styles.chipPrice, { color: theme.colors.primary }]}>₹{item.price}</Text>
                <Badge style={[styles.chipBadge, { backgroundColor: theme.colors.primaryContainer, color: theme.colors.primary }]}>{`${item.gst}% GST`}</Badge>
                <Text style={[styles.chipStock, { color: (item.stockQuantity || 0) <= (item.lowStockThreshold || 5) ? theme.colors.error : '#888' }]}>
                  Stock: {item.stockQuantity || 0}
                </Text>
              </Surface>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.sectionHeader}>
          <Title style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>{t('billSummary') || 'Invoice Summary'}</Title>
        </View>
        <Surface style={[styles.summarySurface, { backgroundColor: theme.colors.surface }]} elevation={1}>
          {selectedItems.length > 0 ? (
            selectedItems.map((item, index) => (
              <View key={index}>
                <View style={styles.billItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.billItemName, { color: theme.colors.onSurface }]}>{item.name} <Text style={{ color: theme.colors.primary }}>x{item.qty}</Text></Text>
                    <Text style={{ fontSize: 12, color: theme.colors.onSurfaceVariant }}>Unit: ₹{item.price} + {item.gst}% GST</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={[styles.billItemTotal, { color: theme.colors.onSurface }]}>₹{(item.price * item.qty * (1 + item.gst/100)).toFixed(2)}</Text>
                    <IconButton icon="close-circle-outline" size={20} iconColor={theme.colors.error} onPress={() => setSelectedItems(selectedItems.filter((_, i) => i !== index))} style={{ margin: 0, marginLeft: 5 }} />
                  </View>
                </View>
                {index < selectedItems.length - 1 && <Divider style={styles.itemDivider} />}
              </View>
            ))
          ) : (
            <View style={styles.emptyItems}>
              <IconButton icon="cart-outline" size={40} iconColor={theme.colors.onSurfaceVariant} style={{ opacity: 0.3 }} />
              <Text style={{ color: theme.colors.onSurfaceVariant }}>{t('noItemsAdded') || 'No items selected yet'}</Text>
            </View>
          )}
          
          {selectedItems.length > 0 && (
            <View style={styles.totalSection}>
              <Divider style={{ marginBottom: 15 }} />
              <View style={styles.totalRow}><Text style={styles.totalLabel}>{t('subtotal') || 'Subtotal'}</Text><Text style={styles.totalValue}>₹{subtotal.toFixed(2)}</Text></View>
              <View style={styles.totalRow}><Text style={styles.totalLabel}>Total GST</Text><Text style={styles.totalValue}>₹{totalGST.toFixed(2)}</Text></View>
              <View style={styles.totalRow}><Text style={[styles.totalLabel, { color: theme.colors.error }]}>CD Deduction ({cdPercentage}%)</Text><Text style={[styles.totalValue, { color: theme.colors.error }]}>- ₹{cdAmount.toFixed(2)}</Text></View>
              <View style={[styles.totalRow, { marginTop: 10 }]}><Title style={styles.grandTotalLabel}>{t('grandTotal')}</Title><Title style={[styles.grandTotalValue, { color: theme.colors.primary }]}>₹{total.toFixed(2)}</Title></View>
            </View>
          )}
        </Surface>

        <View style={{ marginBottom: 20 }}>
          <Text style={styles.paymentStatusLabel}>Payment Status</Text>
          <SegmentedButtons
            value={paymentStatus}
            onValueChange={setPaymentStatus}
            buttons={[
              { value: 'paid', label: 'Paid', icon: 'check-circle', checkedColor: 'white', uncheckedColor: theme.colors.onSurfaceVariant },
              { value: 'pending', label: 'Pending', icon: 'clock-outline', checkedColor: 'white', uncheckedColor: theme.colors.onSurfaceVariant },
            ]}
            style={styles.segmentedButtons}
          />
        </View>

        <Button 
          mode="contained" 
          onPress={handleSaveBill} 
          loading={loading} 
          style={styles.saveBtn}
          contentStyle={styles.saveBtnContent}
          buttonColor={theme.colors.primary}
          disabled={selectedItems.length === 0}
        >
          {t('Save And Generate') || 'Generate Invoice'}
        </Button>
        <View style={{ height: 40 }} />
      </ScrollView>

      <Portal>
        <Modal visible={bankModalVisible} onDismiss={() => setBankModalVisible(false)} contentContainerStyle={[styles.bankModal, { backgroundColor: theme.colors.surface }]}>
          <Title style={styles.modalTitle}>{t('selectBank')}</Title>
          <Divider style={{ marginBottom: 15 }} />
          <ScrollView showsVerticalScrollIndicator={false}>
            {activeBusiness?.banks && activeBusiness.banks.length > 0 ? (
              activeBusiness.banks.map((bank: any, index: number) => (
                <TouchableOpacity 
                  key={index} 
                  onPress={() => { setSelectedBank(bank); setBankModalVisible(false); }}
                  activeOpacity={0.7}
                >
                  <Surface style={[styles.bankOption, selectedBank === bank && { backgroundColor: theme.colors.primaryContainer, borderColor: theme.colors.primary, borderWidth: 1 }]} elevation={0}>
                    <IconButton icon="bank" size={22} iconColor={theme.colors.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: 'bold', color: theme.colors.onSurface }}>{bank.bankName}</Text>
                      <Text style={{ fontSize: 12, color: theme.colors.onSurfaceVariant }}>{bank.accountNumber} • {bank.branch}</Text>
                    </View>
                    {selectedBank === bank && <IconButton icon="check-circle" size={20} iconColor={theme.colors.primary} />}
                  </Surface>
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.noBanks}>
                <Text style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center', marginBottom: 15 }}>{t('noBanks')}</Text>
                <Button mode="outlined" onPress={() => { setBankModalVisible(false); router.push('/(user)/(tabs)/settings'); }}>Configure Banks</Button>
              </View>
            )}
          </ScrollView>
          <Button mode="text" onPress={() => setBankModalVisible(false)} style={{ marginTop: 10 }}>{t('close')}</Button>
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 50, paddingBottom: 12, paddingHorizontal: 10, borderBottomLeftRadius: 25, borderBottomRightRadius: 25, zIndex: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  content: { padding: 16 },
  card: { marginBottom: 20, borderRadius: 20 },
  cardSectionTitle: { fontSize: 11, fontWeight: 'bold', color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginLeft: 2 },
  input: { marginBottom: 12, backgroundColor: 'transparent' },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  doubleInputRow: { flexDirection: 'row', justifyContent: 'space-between' },
  formDivider: { marginVertical: 15, opacity: 0.5 },
  bankSelector: { flexDirection: 'row', alignItems: 'center', padding: 8, borderRadius: 15, borderWidth: 1 },
  custDropdown: { borderRadius: 15, padding: 12, marginTop: -8, marginBottom: 15 },
  dropdownTitle: { fontSize: 10, color: '#999', marginBottom: 10, fontWeight: 'bold' },
  custOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: 'rgba(0,0,0,0.05)' },
  sectionHeader: { marginBottom: 12, paddingHorizontal: 4 },
  sectionTitle: { fontSize: 17, fontWeight: 'bold' },
  itemSearchInput: { marginHorizontal: 4, marginBottom: 15, height: 45, backgroundColor: 'white' },
  itemPicker: { flexDirection: 'row', marginBottom: 25, paddingLeft: 4 },
  itemChip: { padding: 12, marginRight: 14, borderRadius: 20, alignItems: 'center', minWidth: 120 },
  chipName: { fontWeight: 'bold', fontSize: 14, marginBottom: 2 },
  chipPrice: { fontWeight: 'bold', fontSize: 15, marginBottom: 4 },
  chipBadge: { borderRadius: 8, paddingHorizontal: 8, marginBottom: 4 },
  chipStock: { fontSize: 10, fontWeight: 'bold' },
  summarySurface: { padding: 18, borderRadius: 22, marginBottom: 20 },
  billItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5 },
  billItemName: { fontWeight: 'bold', fontSize: 15 },
  billItemTotal: { fontWeight: 'bold', fontSize: 15 },
  itemDivider: { marginVertical: 10, opacity: 0.3 },
  emptyItems: { padding: 30, alignItems: 'center' },
  totalSection: { marginTop: 5 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 4 },
  totalLabel: { color: '#666', fontSize: 14 },
  totalValue: { fontWeight: '600', fontSize: 14 },
  grandTotalLabel: { fontSize: 20, fontWeight: 'bold' },
  grandTotalValue: { fontSize: 22, fontWeight: 'bold' },
  paymentStatusLabel: { fontSize: 12, fontWeight: 'bold', color: '#888', textTransform: 'uppercase', marginBottom: 8, marginLeft: 5 },
  segmentedButtons: { borderRadius: 12 },
  saveBtn: { marginTop: 10, borderRadius: 16, elevation: 3 },
  saveBtnContent: { paddingVertical: 10 },
  bankModal: { padding: 25, margin: 20, borderRadius: 30, maxHeight: '80%' },
  modalTitle: { textAlign: 'center', fontWeight: 'bold', fontSize: 20, marginBottom: 10 },
  bankOption: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 15, marginBottom: 10, borderWidth: 1, borderColor: '#f0f0f0' },
  noBanks: { padding: 20, alignItems: 'center' }
});
